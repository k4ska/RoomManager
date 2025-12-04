export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  nitro: { compatibilityDate: '2025-10-29' },

  runtimeConfig: {
    public: {
      apiBase: (() => {
        const nodeEnv = (globalThis as any).process?.env?.NODE_ENV ?? (import.meta as any).env?.MODE;
        return (globalThis as any).process?.env?.NUXT_PUBLIC_API_BASE ?? (import.meta as any).env?.API_BASE_URL ?? (nodeEnv === 'production' ? '' : 'http://localhost:4000')
      })()
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
