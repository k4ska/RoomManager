// Auth helpers: hashing, JWT, and cookie management
import bcrypt from 'bcryptjs'
import jwtPkg from 'jsonwebtoken'
import { loadConfig } from './config.js'

const jwt = jwtPkg // CJS default interop

// Hashes a plain password
export async function hashPassword(password) {
  const saltRounds = 10
  return await bcrypt.hash(password, saltRounds)
}

// Verifies a plain password against a hash
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash)
}

// Signs a JWT for the given payload
export async function signToken(payload) {
  const { JWT_SECRET } = await loadConfig()
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

// Verifies a JWT and returns the payload or null
export async function verifyToken(token) {
  const { JWT_SECRET } = await loadConfig()
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

// Returns the session cookie name from env
async function getCookieName() {
  const { NODE_ENV } = await loadConfig()
  const name = process.env.SESSION_COOKIE_NAME || 'rm_session'
  return { name, isProd: NODE_ENV === 'production' }
}

// Builds a Set-Cookie header string for the session token
export async function makeSessionCookie(token) {
  const { name, isProd } = await getCookieName()
  const attrs = [
    `${name}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
  ]
  if (isProd) attrs.push('Secure')
  // 7 days
  attrs.push('Max-Age=604800')
  return attrs.join('; ')
}

// Builds a Set-Cookie header string that clears the session
export async function clearSessionCookie() {
  const { name, isProd } = await getCookieName()
  const attrs = [
    `${name}=;`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ]
  if (isProd) attrs.push('Secure')
  return attrs.join('; ')
}

// Parses cookies from the request header into an object
export function parseCookies(req) {
  const header = req.headers['cookie'] || ''
  const out = {}
  header.split(';').forEach(part => {
    const idx = part.indexOf('=')
    if (idx === -1) return
    const k = part.slice(0, idx).trim()
    const v = decodeURIComponent(part.slice(idx + 1).trim())
    if (k) out[k] = v
  })
  return out
}

