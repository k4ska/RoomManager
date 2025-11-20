// Lihtne autentimise abifunktsioon backend-i auth-endpointide kutsumiseks
export function useAuthApi() {
  // Prefer Nuxt runtime public config so the frontend can call the correct backend
  // when deployed. If not set, fall back to the current origin in the browser
  // (so requests go to the same host that serves the frontend).
  const runtime = useRuntimeConfig?.() as any || {}
  const publicCfg = runtime.public || {}
  const publicApiBase = publicCfg.NUXT_PUBLIC_API_BASE ?? publicCfg.apiBase
  const base = publicApiBase || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:4000')
  const userState = useState<any>('user', () => null)

  // Kutsub POST /api/auth/login
  async function login(email: string, password: string) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data?.ok && data.user) userState.value = data.user
    return data
  }

  // Kutsub POST /api/auth/register
  async function register(email: string, password: string, name?: string) {
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name })
    })
    const data = await res.json()
    if (data?.ok && data.user) userState.value = data.user
    return data
  }

  // Kutsub POST /api/auth/logout
  async function logout() {
    try {
      const res = await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
      // Proovi lugeda vastust, kuid ära ebaõnnestu kui tühi
      let ok = res.ok
      try {
        const data = await res.json()
        ok = ok && !!data?.ok
      } catch {}
      // Igal juhul nulli kliendi olek, et UI peegeldaks väljalogimist
      userState.value = null
      return { ok }
    } catch {
      userState.value = null
      return { ok: false }
    }
  }

  // Kutsub GET /api/auth/me
  async function me() {
    const res = await fetch(`${base}/api/auth/me`, {
      method: 'GET',
      credentials: 'include'
    })
    const data = await res.json()
    if (data?.ok && 'user' in data) userState.value = data.user
    return data
  }

  return { login, register, logout, me }
}
