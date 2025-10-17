// Minimal HTTP server with a health route
import http from 'node:http'
import { loadConfig } from './config.js'

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

  // Health check
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'backend', env: NODE_ENV })
  }

  // 404 fallback
  sendJson(res, 404, { ok: false, error: 'Not Found' })
})

const { PORT } = await cfg
server.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`)
})

