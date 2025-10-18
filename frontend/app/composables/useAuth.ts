// Simple auth helper for calling backend auth endpoints
export function useAuthApi() {
  const base = (import.meta as any).env?.NUXT_PUBLIC_API_BASE || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'

  // Calls POST /api/auth/login
  async function login(email: string, password: string) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    return res.json()
  }

  // Calls POST /api/auth/register
  async function register(email: string, password: string, name?: string) {
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name })
    })
    return res.json()
  }

  // Calls POST /api/auth/logout
  async function logout() {
    const res = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    })
    return res.json()
  }

  // Calls GET /api/auth/me
  async function me() {
    const res = await fetch(`${base}/api/auth/me`, {
      method: 'GET',
      credentials: 'include'
    })
    return res.json()
  }

  return { login, register, logout, me }
}

