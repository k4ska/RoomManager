export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  nitro: { compatibilityDate: '2025-10-29' },

  runtimeConfig: {
    public: {
      apiBase: import.meta.env.API_BASE_URL ?? 'http://localhost:5034'
    }
  },
  app: {
    head: {
      title: 'Ruumihaldur',
      bodyAttrs: {
        class: 'bg-[#0b1120] text-gray-100 min-h-screen antialiased'
      }
    }
  }
})
