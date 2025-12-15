<template>
  <div class="toolbar">
    <button class="btn" @click="newRoom">Uus ruum</button>
    <button class="btn" @click="toggleTools">Tööriistad</button>
    <button class="btn success" @click="save">Salvesta ruum</button>
  </div>

  <div
    v-if="showTools"
    ref="toolboxRef"
    class="floating-tools"
    :style="{ left: `${toolboxPos.x}px`, top: `${toolboxPos.y}px` }"
  >
    <div class="drag-handle" @mousedown="startDrag" title="Lohista">
      ⠿
    </div>
    <div class="tools">
      <button class="tool" :class="{ active: store.addPointMode }" @click="toggleAdd" title="Lisa tipp">
        🟢
      </button>
      <button class="tool" :class="{ active: store.addWindowMode }" @click="toggleWindow" title="Lisa aken">
        🪟
      </button>
      <button class="tool" :class="{ active: store.addDoorMode }" @click="toggleDoor" title="Lisa uks">
        🚪
      </button>
      <button class="tool" :class="{ active: store.snapEnabled }" @click="toggleSnap" title="Snap">
        🤌
      </button>
      <button class="tool" :class="{ active: store.showMetrics }" @click="toggleMetrics" title="Mõõdud">
        📏
      </button>
    </div>
    <div class="grid-control">
      <label class="grid-label">1 ruut =</label>
      <input
        v-model.number="gridSizeInput"
        type="number"
        step="0.1"
        min="0.1"
        max="10"
        class="grid-input"
        @input="onGridInput"
      />
      <span class="grid-unit">m</span>
      <input
        v-model.number="gridSizeInput"
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        class="grid-slider"
        @input="onGridInput"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const router = useRouter()
const store = useRoomShapeStore()
const storage = useStorageStore()

const showTools = ref(false)
const toolboxPos = ref({ x: 24, y: 140 })
const toolboxRef = ref<HTMLElement | null>(null)
let dragging = false
let dragOffset = { x: 0, y: 0 }
const gridSizeInput = ref(store.gridSizeMeters || 1)

// Resets the room shape and clears storage
const newRoom = () => { store.resetShape(); storage.clear() }

const setMode = (mode: 'addPoint' | 'addWindow' | 'addDoor' | 'none') => {
  // Lülita KÕIK TÄPSELT VÄLJA
  store.addPointMode = false
  store.addWindowMode = false  
  store.addDoorMode = false
  
  // Lülita ainult VAJALIK SISSE
  if (mode === 'none') return  // KÕIK JÄEVAD VÄLJA ✅
  if (mode === 'addPoint') store.addPointMode = true
  else if (mode === 'addWindow') store.addWindowMode = true
  else if (mode === 'addDoor') store.addDoorMode = true
}

// Toggles grid snapping
const toggleSnap = () => store.toggleSnap()
// Toggles metrics display
const toggleMetrics = () => store.toggleShowMetrics()
// Navigates to the storage layout page
const save = async () => { try { await store.saveToServer() } catch {} ; router.push('/storage') }

const toggleAdd = () => setMode(store.addPointMode ? 'none' : 'addPoint')
const toggleWindow = () => setMode(store.addWindowMode ? 'none' : 'addWindow') 
const toggleDoor = () => setMode(store.addDoorMode ? 'none' : 'addDoor')
const toggleTools = () => { showTools.value = !showTools.value }

function applyGridSize(val: number) {
  const clamped = Math.min(10, Math.max(0.1, val || 1))
  store.setGridSizeMeters(clamped)
  gridSizeInput.value = Number(clamped.toFixed(2))
}

function onGridInput(e: Event) {
  const target = e.target as HTMLInputElement
  applyGridSize(parseFloat(target.value))
}

watch(() => store.gridSizeMeters, (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    gridSizeInput.value = Number(v.toFixed(2))
  }
})

function clampPos(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y }
  const width = toolboxRef.value?.offsetWidth ?? 160
  const height = toolboxRef.value?.offsetHeight ?? 60
  const maxX = Math.max(0, window.innerWidth - width - 12)
  const maxY = Math.max(0, window.innerHeight - height - 12)
  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(80, y), maxY)
  }
}

function startDrag(e: MouseEvent) {
  dragging = true
  dragOffset = { x: e.clientX - toolboxPos.value.x, y: e.clientY - toolboxPos.value.y }
  e.preventDefault()
}

function onMove(e: MouseEvent) {
  if (!dragging) return
  const next = clampPos(e.clientX - dragOffset.x, e.clientY - dragOffset.y)
  toolboxPos.value = next
}

function onUp() {
  dragging = false
}

onMounted(() => {
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
})

</script>

<style scoped>
.toolbar { 
  display: flex; 
  gap: 8px; 
}
.btn {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text);
  border: 1px solid #334155;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .15s ease, transform .1s ease;
}
.btn:hover { 
  background: rgba(148, 163, 184, 0.25); 
}
.btn:active { 
  transform: translateY(1px); 
}
.btn.success { 
  background: var(--accent); 
  color: #062217; 
  border-color: transparent; 
}
.btn.success:hover { 
  background: var(--accent-hover); 
}
.btn.active { 
  outline: 2px solid var(--accent); 
}

.floating-tools {
  position: fixed;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(10, 17, 32, 0.92);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  backdrop-filter: blur(4px);
}
.drag-handle {
  cursor: grab;
  padding: 4px 6px;
  color: #94a3b8;
  user-select: none;
}
.drag-handle:active { cursor: grabbing; }
.tools {
  display: flex;
  gap: 6px;
}
.tool {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid #334155;
  background: rgba(148,163,184,0.12);
  color: #e5e7eb;
  font-weight: 700;
  cursor: pointer;
  transition: background-color .15s ease, transform .1s ease;
}
.tool:hover { background: rgba(148,163,184,0.22); }
.tool:active { transform: translateY(1px); }
.tool.active { outline: 2px solid var(--accent); }

.grid-control {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 13px;
  margin-left: 6px;
}
.grid-label { color: #9ca3af; }
.grid-unit { color: #9ca3af; }
.grid-input {
  width: 72px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid #334155;
  background: rgba(148,163,184,0.12);
  color: #e5e7eb;
}
.grid-slider {
  accent-color: var(--accent);
  width: 140px;
}
</style>
