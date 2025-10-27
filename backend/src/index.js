// Minimal HTTP server with a health route
import http from 'node:http'
import { loadConfig } from './config.js'
import { prisma } from './db.js'
import { hashPassword, verifyPassword, signToken, verifyToken, makeSessionCookie, clearSessionCookie, parseCookies } from './auth.js'

// Parses JSON body from requests
async function parseJson(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
    })
  })
}

// Sends a JSON response
function sendJson(res, status, data, headers = {}) {
  const h = { 'content-type': 'application/json; charset=utf-8', ...headers }
  res.writeHead(status, h)
  res.end(JSON.stringify(data))
}

// Basic CORS handling
function applyCors(req, res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

const cfg = loadConfig()

// Writes a QA log entry without failing the request on error
async function logQA(req, { userId = null, action, details = null, level = 'info' }) {
  try {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || null
    const userAgent = req.headers['user-agent'] || null
    await prisma.qALog.create({ data: { userId, action, level, details, ip, userAgent } })
  } catch (_) {
    // ignore logging failures
  }
}

// Returns the authenticated user or null
async function getAuthUser(req) {
  const cookies = parseCookies(req)
  const cookieName = process.env.SESSION_COOKIE_NAME || 'rm_session'
  const token = cookies[cookieName]
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload?.uid) return null
  const user = await prisma.user.findUnique({
    where: { id: Number(payload.uid) },
    select: { id: true, email: true, name: true }
  })
  return user || null
}

// Ensures the request has an authenticated user; sends 401 otherwise
async function requireAuth(req, res) {
  const user = await getAuthUser(req)
  if (!user) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' })
    return null
  }
  return user
}

const server = http.createServer(async (req, res) => {
  // Await config if it is a promise (module import behavior)
  const { CORS_ORIGIN, NODE_ENV } = await cfg
  if (applyCors(req, res, CORS_ORIGIN)) return

  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const method = req.method || 'GET'

  // Health check
  if (method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'backend', env: NODE_ENV })
  }

  // Auth: register new user
  if (method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await parseJson(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = body.name ? String(body.name) : null
    if (!email || !password) return sendJson(res, 400, { ok: false, error: 'Email and password required' })
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return sendJson(res, 409, { ok: false, error: 'User already exists' })
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { email, passwordHash, name } })
    const token = await signToken({ uid: user.id, email: user.email })
    res.setHeader('Set-Cookie', await makeSessionCookie(token))
    await logQA(req, { userId: user.id, action: 'auth.register', details: { email } })
    return sendJson(res, 201, { ok: true, user: { id: user.id, email: user.email, name: user.name } })
  }

  // Auth: login existing user
  if (method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await parseJson(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!email || !password) return sendJson(res, 400, { ok: false, error: 'Email and password required' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return sendJson(res, 401, { ok: false, error: 'Invalid credentials' })
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return sendJson(res, 401, { ok: false, error: 'Invalid credentials' })
    const token = await signToken({ uid: user.id, email: user.email })
    res.setHeader('Set-Cookie', await makeSessionCookie(token))
    await logQA(req, { userId: user.id, action: 'auth.login', details: { email } })
    return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email, name: user.name } })
  }

  // Auth: logout (clear cookie)
  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    const user = await getAuthUser(req)
    res.setHeader('Set-Cookie', await clearSessionCookie())
    await logQA(req, { userId: user?.id ?? null, action: 'auth.logout' })
    return sendJson(res, 200, { ok: true })
  }

  // Auth: current user
  if (method === 'GET' && url.pathname === '/api/auth/me') {
    const cookies = parseCookies(req)
    const cookieName = process.env.SESSION_COOKIE_NAME || 'rm_session'
    const token = cookies[cookieName]
    if (!token) return sendJson(res, 200, { ok: true, user: null })
    const payload = await verifyToken(token)
    if (!payload?.uid) return sendJson(res, 200, { ok: true, user: null })
    const user = await prisma.user.findUnique({ where: { id: Number(payload.uid) }, select: { id: true, email: true, name: true } })
    return sendJson(res, 200, { ok: true, user })
  }

  // -------- Room shape (persist editor polygon) --------
  if (url.pathname === '/api/room-shape' && method === 'GET') {
    const user = await requireAuth(req, res); if (!user) return
    const room = await prisma.room.findFirst({ where: { userId: user.id }, select: { id: true, shape: true } })
    if (!room) {
      const created = await prisma.room.create({ data: { userId: user.id, name: 'Minu tuba' } })
      return sendJson(res, 200, { ok: true, shape: null, roomId: created.id })
    }
    return sendJson(res, 200, { ok: true, shape: room.shape ?? null, roomId: room.id })
  }

  if (url.pathname === '/api/room-shape' && method === 'PATCH') {
    const user = await requireAuth(req, res); if (!user) return
    const body = await parseJson(req)
    const points = Array.isArray(body?.points) ? body.points : null
    if (!points) return sendJson(res, 400, { ok: false, error: 'points required' })
    let room = await prisma.room.findFirst({ where: { userId: user.id }, select: { id: true } })
    if (!room) room = await prisma.room.create({ data: { userId: user.id, name: 'Minu tuba' }, select: { id: true } })
    const updated = await prisma.room.update({ where: { id: room.id }, data: { shape: points }, select: { id: true } })
    return sendJson(res, 200, { ok: true, roomId: updated.id })
  }

  // ---------- Rooms (user-scoped) ----------
  if (url.pathname === '/api/rooms' && method === 'GET') {
    const user = await requireAuth(req, res); if (!user) return
    const rooms = await prisma.room.findMany({
      where: { userId: user.id },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true }
    })
    await logQA(req, { userId: user.id, action: 'rooms.list', details: { count: rooms.length } })
    return sendJson(res, 200, { ok: true, rooms })
  }

  if (url.pathname === '/api/rooms' && method === 'POST') {
    const user = await requireAuth(req, res); if (!user) return
    const body = await parseJson(req)
    const name = String(body.name || 'Minu tuba')
    const room = await prisma.room.create({ data: { userId: user.id, name } })
    await logQA(req, { userId: user.id, action: 'rooms.create', details: { roomId: room.id } })
    return sendJson(res, 201, { ok: true, room })
  }

  // /api/rooms/:roomId/units
  const roomUnitsMatch = url.pathname.match(/^\/api\/rooms\/(\d+)\/units$/)
  if (roomUnitsMatch && method === 'GET') {
    const user = await requireAuth(req, res); if (!user) return
    const roomId = Number(roomUnitsMatch[1])
    const room = await prisma.room.findFirst({ where: { id: roomId, userId: user.id } })
    if (!room) return sendJson(res, 404, { ok: false, error: 'Room not found' })
    const units = await prisma.storageUnit.findMany({
      where: { roomId },
      orderBy: { id: 'asc' },
      include: { items: true }
    })
    await logQA(req, { userId: user.id, action: 'units.list', details: { roomId, count: units.length } })
    return sendJson(res, 200, { ok: true, units })
  }

  if (roomUnitsMatch && method === 'POST') {
    const user = await requireAuth(req, res); if (!user) return
    const roomId = Number(roomUnitsMatch[1])
    const room = await prisma.room.findFirst({ where: { id: roomId, userId: user.id } })
    if (!room) return sendJson(res, 404, { ok: false, error: 'Room not found' })
    const body = await parseJson(req)
    const data = {
      roomId,
      type: body.type,
      x: Number(body.x || 0),
      y: Number(body.y || 0),
      w: Number(body.w || 56),
      h: Number(body.h || 56),
      rotation: Number(body.rotation || 0),
      emoji: String(body.emoji || '📦'),
      name: body.name ? String(body.name) : null
    }
    const unit = await prisma.storageUnit.create({ data })
    await logQA(req, { userId: user.id, action: 'units.create', details: { roomId, unitId: unit.id, type: unit.type } })
    return sendJson(res, 201, { ok: true, unit })
  }

  // PATCH/DELETE unit by id: /api/units/:unitId
  const unitMatch = url.pathname.match(/^\/api\/units\/(\d+)$/)
  if (unitMatch && (method === 'PATCH' || method === 'DELETE')) {
    const user = await requireAuth(req, res); if (!user) return
    const unitId = Number(unitMatch[1])
    const unit = await prisma.storageUnit.findUnique({
      where: { id: unitId },
      include: { room: { select: { userId: true } } }
    })
    if (!unit || unit.room.userId !== user.id) return sendJson(res, 404, { ok: false, error: 'Unit not found' })
    if (method === 'DELETE') {
      await prisma.storageUnit.delete({ where: { id: unitId } })
      await logQA(req, { userId: user.id, action: 'units.delete', details: { unitId } })
      return sendJson(res, 200, { ok: true })
    }
    const body = await parseJson(req)
    const patch = {}
    for (const k of ['x','y','w','h','rotation','emoji','name','type']) {
      if (k in body) patch[k] = body[k]
    }
    const updated = await prisma.storageUnit.update({ where: { id: unitId }, data: patch })
    await logQA(req, { userId: user.id, action: 'units.update', details: { unitId, patchKeys: Object.keys(patch) } })
    return sendJson(res, 200, { ok: true, unit: updated })
  }

  // Items for a unit
  const unitItemsMatch = url.pathname.match(/^\/api\/units\/(\d+)\/items$/)
  if (unitItemsMatch && method === 'GET') {
    const user = await requireAuth(req, res); if (!user) return
    const unitId = Number(unitItemsMatch[1])
    const unit = await prisma.storageUnit.findUnique({ include: { room: true }, where: { id: unitId } })
    if (!unit || unit.room.userId !== user.id) return sendJson(res, 404, { ok: false, error: 'Unit not found' })
    const items = await prisma.item.findMany({ where: { unitId }, orderBy: { id: 'asc' } })
    await logQA(req, { userId: user.id, action: 'items.list', details: { unitId, count: items.length } })
    return sendJson(res, 200, { ok: true, items })
  }

  if (unitItemsMatch && method === 'POST') {
    const user = await requireAuth(req, res); if (!user) return
    const unitId = Number(unitItemsMatch[1])
    const unit = await prisma.storageUnit.findUnique({ include: { room: true }, where: { id: unitId } })
    if (!unit || unit.room.userId !== user.id) return sendJson(res, 404, { ok: false, error: 'Unit not found' })
    const body = await parseJson(req)
    const item = await prisma.item.create({ data: { unitId, name: String(body.name || 'Ese'), quantity: Number(body.quantity || 1) } })
    await logQA(req, { userId: user.id, action: 'items.create', details: { unitId, itemId: item.id } })
    return sendJson(res, 201, { ok: true, item })
  }

  // PATCH/DELETE item by id: /api/items/:itemId
  const itemMatch = url.pathname.match(/^\/api\/items\/(\d+)$/)
  if (itemMatch && (method === 'PATCH' || method === 'DELETE')) {
    const user = await requireAuth(req, res); if (!user) return
    const itemId = Number(itemMatch[1])
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { unit: { include: { room: true } } }
    })
    if (!item || item.unit.room.userId !== user.id) return sendJson(res, 404, { ok: false, error: 'Item not found' })
    if (method === 'DELETE') {
      await prisma.item.delete({ where: { id: itemId } })
      await logQA(req, { userId: user.id, action: 'items.delete', details: { itemId } })
      return sendJson(res, 200, { ok: true })
    }
    const body = await parseJson(req)
    const patch = {}
    for (const k of ['name','quantity']) { if (k in body) patch[k] = body[k] }
    const updated = await prisma.item.update({ where: { id: itemId }, data: patch })
    await logQA(req, { userId: user.id, action: 'items.update', details: { itemId, patchKeys: Object.keys(patch) } })
    return sendJson(res, 200, { ok: true, item: updated })
  }

  // 404 fallback
  sendJson(res, 404, { ok: false, error: 'Not Found' })
})

const { PORT } = await cfg
server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`)
})
