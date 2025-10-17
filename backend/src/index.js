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
    return sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email, name: user.name } })
  }

  // Auth: logout (clear cookie)
  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    res.setHeader('Set-Cookie', await clearSessionCookie())
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

  // 404 fallback
  sendJson(res, 404, { ok: false, error: 'Not Found' })
})

const { PORT } = await cfg
server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`)
})
