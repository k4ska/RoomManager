// Redirects to /login when user is not authenticated
export default defineNuxtRouteMiddleware(async (to) => {
  // Redirect to /login when user is not authenticated
  // Only run this check on the client for simplicity
  if (import.meta.server) return
  const userState = useState<any>('user', () => null)

  // If we already have a user in state, allow
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
