// Lihtne autentimise abifunktsioon backend-i auth-endpointide kutsumiseks
export function useAuthApi() {
    // runtimeConfig (nuxt.config) eelistus, see töötab nii dev kui prod builds
  const runtime = (useRuntimeConfig?.() as any) || {}
  const publicCfg = runtime.public || {}
  const publicApiBase = publicCfg.apiBase || (import.meta as any).env?.NUXT_PUBLIC_API_BASE || (globalThis as any).process?.env?.NUXT_PUBLIC_API_BASE || ''

  // Kontroll, kas jookseme serveris (SSR) — ainult siis loeme server-poolseid runtime võtmeid
  const isServer = typeof window === 'undefined'

  // Sisemine base SSR-iks / konteinerite vaheliseks sideks (loe ainult serveri kontekstis)
  let internalApiBase = ''
  if (isServer) {
    internalApiBase = runtime.API_INTERNAL_BASE || runtime.apiInternalBase || (import.meta as any).env?.API_INTERNAL_BASE || (globalThis as any).process?.env?.API_INTERNAL_BASE || ''
  }

  // Server (SSR) eelistab sisemist base'i; klient kasutab avalikku base'i
  // Server (SSR) should prefer internal API base (container-to-container).
  // Client (browser) should use publicApiBase when set, otherwise use relative paths (empty string)
  const base = isServer
    ? (internalApiBase || publicApiBase || 'http://back-end:8080')
    : (publicApiBase || '')

  const userState = useState<any>('user', () => null)

  // abifunktsioon, et kokku panna korrektsed URLid (väldib // topelt)
  function apiUrl(path: string) {
    const p = path.startsWith('/') ? path : `/${path}`
    if (!base) return p
    try {
      return new URL(p, base).toString()
    } catch {
      return `${String(base).replace(/\/+$/, '')}${p}`
    }
  }

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
      let ok = res.ok
      try {
        const data = await res.json()
        ok = ok && !!data?.ok
      } catch {}
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