// Global auth guard: redirects any route to /login when unauthenticated
export default defineNuxtRouteMiddleware(async (to) => {
  // If user tries to access auth pages while already authenticated, redirect to homepage
  if (to.path === '/login' || to.path === '/register') {
    // SSR: check cookie
    if (import.meta.server) {
      const sess = useCookie<string | null>('rm_session')
      if (sess.value) return navigateTo('/')
      return
    }

    // Client: check in-memory state or call /me
    const userState = useState<any>('user', () => null)
    if (userState.value) return navigateTo('/')
    const { useAuthApi } = await import('~/composables/useAuth')
    const { me } = useAuthApi()
    try {
      const res = await me()
      if (res?.user) {
        userState.value = res.user
        return navigateTo('/')
      }
    } catch {}

    // Not authenticated -> allow access to /login or /register
    return
  }

  // For all other routes: do not enforce global auth.
  // Per-page guards (e.g., editor/storage) will handle protection.
  return
})
