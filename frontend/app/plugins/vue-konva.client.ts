import VueKonva from 'vue-konva'
// Registers the Vue Konva plugin for canvas rendering
export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.use(VueKonva)
})
