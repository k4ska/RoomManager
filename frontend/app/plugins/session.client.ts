// Bootstraps the user session on app start (client-only)
export default defineNuxtPlugin(async () => {
  const userState = useState<any>('user', () => null)
  if (userState.value) return
  try {
    const { useAuthApi } = await import('~/composables/useAuth')
    const { me } = useAuthApi()
    await me()
  } catch {}
})

