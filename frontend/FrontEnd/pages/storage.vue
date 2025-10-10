<template>
  <div class="storage-wrap">
    <header class="head">
      <h1>Ladustuse paigutus</h1>
      <div class="actions">
        <NuxtLink class="btn" to="/editor">Tagasi</NuxtLink>
        <button class="btn warn" @click="removeSelected" :disabled="!selectedId">Kustuta valitu</button>
        <button class="btn warn" @click="removeAll" :disabled="!hasItems">Kustuta kõik</button>
        <button class="btn success" @click="goView">Salvesta → Vaade</button>
      </div>
    </header>

    <section class="content">
      <div class="canvas-card">
        <div class="hint">Lohista „Kast”, „Kapp” või „Riiul” lõuendile ja liiguta neid.</div>
        <ClientOnly>
          <StorageCanvas />
        </ClientOnly>
      </div>
      <StorageSelector />
    </section>
  </div>
</template>

<script setup lang="ts">
import StorageSelector from '~/components/StorageSelector.vue'
import StorageCanvas from '~/components/StorageCanvas.vue'
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStorageStore } from '~/stores/storageStore'
const router = useRouter()
function goView() { router.push('/view') }

const storage = useStorageStore()
const hasItems = computed(() => storage.items.length > 0)
// get selectedId from canvas via window event bus fallback
const selectedId = ref<number | null>(null)
if (typeof window !== 'undefined') {
  ;(window as any).__rm_setSelected = (id: number | null) => { selectedId.value = id }
}
function removeSelected(){ if (selectedId.value != null) storage.removeUnit(selectedId.value); selectedId.value = null }
function removeAll(){ storage.clear(); selectedId.value = null }
</script>

<style scoped>
.storage-wrap { min-height: 100vh; max-width: 1200px; margin: 0 auto; padding: 20px; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.content { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
.canvas-card { background: rgba(17,24,39,0.8); border: 1px solid #334155; border-radius: 16px; padding: 12px; overflow: hidden; }
.hint { color: #9ca3af; margin: 6px; font-size: .95rem; }
.actions { display: flex; gap: 8px; }
.btn { background: rgba(148,163,184,0.15); color: var(--text); border: 1px solid #334155; padding: 8px 12px; border-radius: 10px; font-weight: 700; text-decoration: none; }
.btn:hover { background: rgba(148,163,184,0.25); }
.btn.warn { background: rgba(244,63,94,0.15); border-color: #7f1d1d; }
.btn.warn:hover { background: rgba(244,63,94,0.25); }
.btn.success { background: var(--accent); color: #062217; border-color: transparent; }
.btn.success:hover { background: var(--accent-hover); }
</style>
