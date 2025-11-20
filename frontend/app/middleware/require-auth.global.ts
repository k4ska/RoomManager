// Global auth guard: enforce authentication for all routes except /login and /register.
// Behavior:
// - If route is /login or /register: redirect to `/` when already authenticated.
// - For any other route: perform a quick check (SSR cookie or client `me()`) and
//   redirect to `/login` if the user is not authenticated.
export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login', '/register']

  // Handle auth pages: if user already authenticated, send to '/'
  if (publicPaths.includes(to.path)) {
    if (import.meta.server) {
      const sess = useCookie<string | null>('rm_session')
      if (sess.value) return navigateTo('/')
      return
    }

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

    // Allow access to login/register when unauthenticated
    return
  }

  // For all other routes: require authentication. Check quickly on server via cookie.
  if (import.meta.server) {
    const sess = useCookie<string | null>('rm_session')
    if (!sess.value) return navigateTo('/login')
    return
  }

  // Client-side: check in-memory state first, then call /me as a fallback.
  const userState = useState<any>('user', () => null)
  if (userState.value) return

  const { useAuthApi } = await import('~/composables/useAuth')
  const { me } = useAuthApi()
  try {
    const res = await me()
    if (res?.user) {
      userState.value = res.user
      return
    }
  } catch {}

  // Not authenticated -> send to login
  return navigateTo('/login')
})
