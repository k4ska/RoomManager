// Lihtne autentimise abifunktsioon backend-i auth-endpointide kutsumiseks
export function useAuthApi() {
  // Prefer Nuxt runtime public config so the frontend can call the correct backend
  // when deployed. If not set, fall back to the current origin in the browser
  // (so requests go to the same host that serves the frontend).
  const runtime = useRuntimeConfig?.() as any || {}
  const publicCfg = runtime.public || {}
  const publicApiBase = publicCfg.NUXT_PUBLIC_API_BASE ?? publicCfg.apiBase
  // If a public API base is provided via runtime config use it. Otherwise
  // default to an empty string so fetch calls become relative (e.g. `/api/...`).
  // Relative requests are recommended when you reverse-proxy the backend
  // under the same origin as the frontend (avoids mixed-content and CORS).
  const base = publicApiBase ?? ''
  // Debug helper in dev: log resolved base so it's easy to verify in browser console
  const mode = (import.meta as any).env?.MODE || (import.meta as any).env?.VITE_ENV || 'production'
  if (mode !== 'production' && typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[useAuthApi] API base =', base || '(relative / same-origin)')
  }

  // Helper to build a correct absolute URL for the API endpoint.
  // If `base` is empty we use the same origin (relative) path.
  function apiUrl(path: string) {
    // ensure path starts with a single leading slash
    const p = path.startsWith('/') ? path : `/${path}`
    if (!base) return p
    try {
      // new URL with an absolute path will produce the correct URL even if base contains a path
      return new URL(p, base).toString()
    } catch {
      // fallback: naive join but avoid double slashes
      return `${base.replace(/\/+$/, '')}${p}`
    }
  }
  const userState = useState<any>('user', () => null)

  // Kutsub POST /api/auth/login
  async function login(email: string, password: string) {
    const res = await fetch(apiUrl('/api/auth/login'), {
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
    const res = await fetch(apiUrl('/api/auth/register'), {
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
      const res = await fetch(apiUrl('/api/auth/logout'), {
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
    const res = await fetch(apiUrl('/api/auth/me'), {
      method: 'GET',
      credentials: 'include'
    })
    const data = await res.json()
    if (data?.ok && 'user' in data) userState.value = data.user
    return data
  }

  return { login, register, logout, me }
}
