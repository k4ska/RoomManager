<template>
  <div class="view-wrap">
    <header class="head">
      <h1>Ruumivaade</h1>
      <div class="actions">
        <NuxtLink class="btn" to="/storage">Muuda paigutust</NuxtLink>
      </div>
    </header>
    <section class="canvas-card">
      <ClientOnly>
        <ViewCanvas :selected-id="selectedId" @select="id => { selectedId = id; showPopup = id !== null }" />
      </ClientOnly>
    </section>

    <UusObjectPopup v-if="showPopup" :unit-id="selectedId" @close="showPopup=false" />
  </div>
</template>

<script setup lang="ts">
import ViewCanvas from '~/components/ViewCanvas.vue'
import UusObjectPopup from '~/components/uusObjectPopup.vue'
import { ref } from 'vue'
import { onMounted } from 'vue'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'


// Vaateleht on avalik (kiire juurdepääs avalehelt)
const selectedId = ref<number | null>(null)
const showPopup = ref(false)

// Laeb salvestatud toakuju ja üksused ainult lugemiseks
const shape = useRoomShapeStore()
const store = useStorageStore()
onMounted(async () => {
  try {
    await shape.loadFromServer()
    await store.ensureRoom()
    await store.loadUnits()
  } catch {}
})
</script>

<style scoped>
.view-wrap { 
  min-height: 100vh; 
  max-width: 1080px; 
  margin: 0 auto; 
  padding: 20px; 
}
.head { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 14px; 
}
.canvas-card { 
  background: rgba(17,24,39,0.8); 
  border: 1px solid #334155; 
  border-radius: 16px; 
  padding: 12px; 
}
.actions { 
  display: flex; 
  gap: 8px; 
}
.btn { 
  background: var(--accent); 
  color: #062217; 
  border-radius: 10px; 
  padding: 8px 12px; 
  font-weight: 700; 
  text-decoration: none; 
  border: none; 
  cursor: pointer; 
}
.btn:hover { 
  background: var(--accent-hover); 
}
.btn:disabled { 
  opacity: .5; 
  cursor: not-allowed; 
}
</style>
