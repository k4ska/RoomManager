<template>
  <UApp>
    <HeaderBar />
    <NuxtPage />
    <ConfirmPopup ref="confirmPopup" />
  </UApp>
</template>

<script setup lang="ts">
import HeaderBar from '~/components/HeaderBar.vue'
import ConfirmPopup from '~/components/ConfirmPopup.vue'


const confirmPopup = ref()
provide('confirmPopup', confirmPopup)
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

:root {
  --bg-start: #0b1120; /* Nuxt dark */
  --bg-end: #1a2238;   /* Deep blue */
  --text: #e5e7eb;     /* Gray 200 */
  --muted: #9ca3af;    /* Gray 400 */
  --accent: #10b981;   /* Emerald 500 */
  --accent-hover: #059669; /* Emerald 600 */
}

html, body, #__nuxt {
  height: 100%;
}

html {
  font-family: 'Inter', sans-serif;
}

body {
  margin: 0;
  background: linear-gradient(to bottom, var(--bg-start), var(--bg-end));
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
