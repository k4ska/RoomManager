// Global auth guard: redirects any route to /login when unauthenticated
export default defineNuxtRouteMiddleware(async (to) => {
  // Allow auth pages without redirect loop
  if (to.path === '/login' || to.path === '/register') return

  // 1) SSR guard: check cookie directly on the server request
  if (import.meta.server) {
    const sess = useCookie<string | null>('rm_session')
    if (!sess.value) return navigateTo('/login')
    return
  }

  // 2) Client guard: use in-memory state or call /me
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

  return navigateTo('/login')
})
