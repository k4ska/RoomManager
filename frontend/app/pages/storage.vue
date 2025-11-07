<template>
  <div class="storage-wrap">
    <header class="head">
      <h1>Ladustuse paigutus</h1>
      <div class="actions">
        <NuxtLink class="btn" to="/editor">Tagasi</NuxtLink>
        <button class="btn warn" :disabled="!selectedId" @click="removeSelected">Kustuta valitu</button>
        <button class="btn warn" :disabled="!hasItems" @click="removeAll">Kustuta kõik</button>
        <button class="btn success" @click="goView">Salvesta ja vaade</button>
      </div>
    </header>

    <section class="content">
      <StorageSelector />
      <div class="canvas-card">
        <div class="hint">
          Lohista „Kast”, „Kapp” või „Riiul” lõuendile ja liiguta neid.
        </div>
        <ClientOnly>
          <StorageCanvas />
        </ClientOnly>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import StorageSelector from '~/components/StorageSelector.vue'
import StorageCanvas from '~/components/StorageCanvas.vue'
import { useRouter } from 'vue-router'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useConfirm } from '~/composables/useConfirm' 

definePageMeta({ middleware: 'auth' })

const router = useRouter()
const shape = useRoomShapeStore()
const store = useStorageStore()
const { confirm } = useConfirm()

const hasItems = computed(() => store.items.length > 0)
const selectedId = ref<number | null>(null)

// ✅ Open the view page after saving
// async function goView() {
//   try {
//     await shape.saveToServer()
//   } catch {}
//   router.push('/view')
// }

// ✅ Store currently selected unit id
function setSelected(id: number | null) {
  selectedId.value = id
}

// ✅ Install bridge to update selection from canvas
onMounted(async () => {
  ;(window as any).__rm_setSelected = setSelected
  try {
    await shape.loadFromServer()
    await store.ensureRoom()
    await store.loadUnits()
  } catch {}
})

// ✅ Clean up on unmount
onBeforeUnmount(() => {
  delete (window as any).__rm_setSelected
})

// ✅ Remove selected unit
function removeSelected() {
  if (selectedId.value != null) {
    store.removeUnit(selectedId.value)
    selectedId.value = null
  }
}

// ✅ Custom confirm popup instead of window.confirm
async function removeAll() {
  if (!hasItems.value) return

  const ok = await confirm({
    title: 'Kustuta kõik üksused?',
    message: 'Seda toimingut ei saa tagasi võtta.'
  })

  if (ok) {
    await store.clear()
    selectedId.value = null
  }
}

// Salvesta ainult (toa kuju + paigutus). Jää samale lehele
async function saveOnly(): Promise<boolean> {
  try {
    await shape.saveToServer()
    // Ensure room exists and refresh local id state
    await store.ensureRoom()
    const ok = await store.saveToServer()
    if (!ok) { console.error('save failed'); return false }
    // Sync from server to reflect canonical ids after save
    await store.loadUnits()
    return true
  } catch (e) {
    console.error('saveOnly failed', e)
    return false
  }
}

// Salvesta ja liigu vaatele
async function goView() {
  const ok = await saveOnly()
  if (ok) router.push('/view')
  else console.error('Salvestamine ebaõnnestus')
}
</script>

<style scoped>
.storage-wrap {
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.content {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 32px;
  align-items: start;
}
.content :deep(.sidebar) {
  margin-right: 4px;
  box-sizing: border-box;
}
.canvas-card {
  background: rgba(17, 24, 39, 0.8);
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 12px;
  overflow: hidden;
}
.hint {
  color: #9ca3af;
  margin: 6px;
  font-size: 0.95rem;
}
.actions {
  display: flex;
  gap: 8px;
}
.btn {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text);
  border: 1px solid #334155;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 700;
  text-decoration: none;
}
.btn:hover {
  background: rgba(148, 163, 184, 0.25);
}
.btn.warn {
  background: rgba(244, 63, 94, 0.15);
  border-color: #7f1d1d;
}
.btn.warn:hover {
  background: rgba(244, 63, 94, 0.25);
}
.btn.success {
  background: var(--accent);
  color: #062217;
  border-color: transparent;
}
.btn.success:hover {
  background: var(--accent-hover);
}
</style>

