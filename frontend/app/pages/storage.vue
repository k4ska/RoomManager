<template>
  <div class="storage-wrap">
    <header class="head">
      <h1>Ladustuse paigutus</h1>
      <div class="actions">
        <NuxtLink class="btn" to="/editor">Tagasi</NuxtLink>
        <button class="btn warn" :disabled="selectedIds.length === 0" @click="removeSelected">Kustuta valitud ({{selectedIds.length}})
        </button>
        <button class="btn warn" :disabled="!hasItems" @click="removeAll">Kustuta kõik</button>
        <button class="btn success" @click="goView">Salvesta ja vaade</button>
      </div>
    </header>

    <section class="content">
      <StorageSelector />
      <div class="canvas-card">
        <div class="hint-row">
          <div class="hint">
            Lohista „Kast”, „Kapp” või „Riiul” lõuendile. Klõpsa objektidel, et neid valida (või tühista valik).
          </div>
          <div class="grid-label">{{ gridLabel }}</div>
        </div>
        <ClientOnly>
          <StorageCanvas />
        </ClientOnly>
      </div>
    </section>
      <UusConfirmPopup ref="confirmRef" />
  </div>
</template>

<script setup lang="ts">
import StorageSelector from '~/components/StorageSelector.vue'
import StorageCanvas from '~/components/StorageCanvas.vue'
import { useRouter } from 'vue-router'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'
import UusConfirmPopup from '~/components/uusConfirmPopup.vue'


const router = useRouter()
const shape = useRoomShapeStore()
const store = useStorageStore()
const confirmRef = ref<any>(null)
const gridLabel = computed(() => {
  const meters = shape.gridSizeMeters || 1
  const text = Math.abs(Math.round(meters) - meters) < 1e-6 ? `${Math.round(meters)}` : `${meters.toFixed(2)}`
  return `1 ruudu külg = ${text} m`
})

const hasItems = computed(() => store.items.length > 0)
const selectedId = ref<number | null>(null)
const selectedIds = ref<number[]>([]) // ainult et mitu asja korraga kustutada
watch(selectedIds, (newVal) => {
  console.log('selectedIds changed:', newVal)
})
/*  ✅ Open the view page after saving
async function goView() {
  try {
    await shape.saveToServer()
  } catch {}
  router.push('/view')
}
*/

// ✅ Store currently selected unit id
function setSelected(id: number | null) {
  console.log('setSelected called:', id)
  selectedId.value = id
}

function setSelectedIds(ids: number[]) {
  console.log('setSelectedIds called:', ids)
  selectedIds.value = ids
}

// ✅ Install bridge to update selection from canvas
onMounted(async () => {
  ;(window as any).__rm_setSelected = setSelected
  ;(window as any).__rm_setSelectedIds = setSelectedIds
  try {
    const roomId = await store.ensureRoom()
    await shape.loadFromServer(roomId)
    await store.loadUnits()
  } catch {}
})

// ✅ Clean up on unmount
onBeforeUnmount(() => {
  delete (window as any).__rm_setSelected
  delete (window as any).__rm_setSelectedIds
})

/* ✅ Remove selected unit
function removeSelected() {
  if (selectedId.value != null) {
    store.removeUnit(selectedId.value)
    selectedId.value = null
  }
}
*/

async function removeSelected() {
  console.log('removeSelected called, selectedIds:', selectedIds.value)
  if (selectedIds.value.length === 0) return
  
  const count = selectedIds.value.length
  const ok = await confirmRef.value?.open({
    title: `Kustuta ${count} üksust?`,
    message: 'Seda toimingut ei saa tagasi võtta.'
  })
  
  if (!ok) return

  for (const id of selectedIds.value) {
    await store.removeUnit(id)
  }

  selectedId.value = null
  selectedIds.value = []
}

// ✅ Custom confirm popup instead of window.confirm
async function removeAll() {
  if (!hasItems.value) return

  const ok = await confirmRef.value?.open({
    title: 'Kustuta kõik üksused?',
    message: 'Seda toimingut ei saa tagasi võtta.'
  })

  if (ok) {
    await store.clear()
    selectedId.value = null
    selectedIds.value = []
  }
}

// Salvesta ainult (toa kuju + paigutus). Jää samale lehele
async function saveOnly(): Promise<boolean> {
  try {
    const roomId = await store.ensureRoom()
    await shape.saveToServer(roomId)
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
  else console.error('Salvestamine ebaõnnestus')}
</script>

<style scoped>
.storage-wrap {
  min-height: 100vh;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 16px 18px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.content {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
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
  min-height: 820px;
}
.hint-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #9ca3af;
  margin: 6px;
  font-size: 0.95rem;
}
.hint {
  flex: 1;
}
.grid-label {
  white-space: nowrap;
  font-weight: 600;
  color: #cbd5e1;
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

.btn:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.25);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

