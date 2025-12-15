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
  <div class="tools-row">
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
</div>

  <div
    v-if="store.showMetrics"
    ref="metricsRef"
    class="metrics-floating"
    :style="{ left: `${metricsPos.x}px`, top: `${metricsPos.y}px` }"
  >
    <div class="metrics-header" @mousedown="startMetricsDrag" title="Lohista">
      <div>Mõõdud</div>
      <button class="simple-close" @click="store.toggleShowMetrics()">×</button>
    </div>
    <div class="metrics-body">
      <div class="row">
        <label>Ruumi pindala (m²):</label>
        <div>{{ roomAreaM2.toFixed(2) }}</div>
      </div>
      <div class="row">
        <label>Uute uste suund:</label>
        <select v-model="store.doorDirection" @change="store.saveToServer()">
          <option value="inside">Sisse</option>
          <option value="outside">Välja</option>
        </select>
      </div>
      <div class="doors-list">
        <div class="doors-header">Uksed</div>
        <div v-for="(door, i) in store.doors" :key="'d' + i" class="door-row">
          <div class="door-label">U{{ i + 1 }}</div>
          <select @change="(e) => {
            const target = e.target as HTMLSelectElement
            const newDir = target.value as 'inside' | 'outside'
            const door = { ...store.doors[i], direction: newDir }
            store.doors.splice(i, 1, door)
            store.saveToServer()
          }">
            <option value="inside" :selected="(door.direction || 'inside') === 'inside'">Sisse</option>
            <option value="outside" :selected="door.direction === 'outside'">Välja</option>
          </select>
        </div>
      </div>
      <div class="walls-list">
        <div class="walls-header">Seinad</div>
        <div v-for="(_, i) in store.points" :key="'w' + i" class="wall-row">
          <div class="wall-label">S{{ i + 1 }}</div>
          <input class="wall-meter" type="number" :value="store.getWallLengthMeters(i).toFixed(2)" @input="e => onWallMetersChange(i, parseFloat((e.target as any).value || '0'))" step="0.1" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'

const router = useRouter()
const store = useRoomShapeStore()
const storage = useStorageStore()

const showTools = ref(false)
const toolboxPos = ref({ x: 24, y: 140 })
const toolboxRef = ref<HTMLElement | null>(null)
const metricsRef = ref<HTMLElement | null>(null)
const metricsPos = ref({ x: 24, y: 220 })
let activeDrag: 'tools' | 'metrics' | null = null
let dragOffset = { x: 0, y: 0 }
const gridSizeInput = ref(store.gridSizeMeters || 1)
const roomAreaM2 = computed(() => {
  const pts = store.points
  if (!pts.length) return 0
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  const pxArea = Math.abs(area) / 2
  const pxPerM = store.metricsScale || 1
  return pxArea / (pxPerM * pxPerM)
})

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
const save = async () => {
  try { await store.saveToServer() } catch {}
  store.showMetrics = false
  showTools.value = false
  router.push('/storage')
}

const toggleAdd = () => setMode(store.addPointMode ? 'none' : 'addPoint')
const toggleWindow = () => setMode(store.addWindowMode ? 'none' : 'addWindow') 
const toggleDoor = () => setMode(store.addDoorMode ? 'none' : 'addDoor')
const toggleTools = () => { showTools.value = !showTools.value }
const closePanels = () => { store.showMetrics = false; showTools.value = false }

function applyGridSize(val: number) {
  const clamped = Math.min(10, Math.max(0.1, val || 1))
  store.setGridSizeMeters(clamped)
  gridSizeInput.value = Number(clamped.toFixed(2))
}

function onGridInput(e: Event) {
  const target = e.target as HTMLInputElement
  applyGridSize(parseFloat(target.value))
}

function getWallPixels(edgeIndex: number) {
  const a = store.points[edgeIndex]
  const b = store.points[(edgeIndex + 1) % store.points.length]
  if (!a || !b) return 0
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function resizeWall(edgeIndex: number, newLengthMeters: number) {
  const a = store.points[edgeIndex]
  const b = store.points[(edgeIndex + 1) % store.points.length]
  if (!a || !b) return
  const dx = b.x - a.x
  const dy = b.y - a.y
  const current = Math.hypot(dx, dy)
  if (current === 0) return
  const newPx = Math.max(1, newLengthMeters * store.metricsScale)
  const ratio = newPx / current
  const nx = a.x + dx * ratio
  const ny = a.y + dy * ratio
  store.updatePoint((edgeIndex + 1) % store.points.length, nx, ny)
  store.saveToServer()
}

function onWallMetersChange(edgeIndex: number, newLengthMeters: number) {
  if (!newLengthMeters || newLengthMeters <= 0) return
  const px = getWallPixels(edgeIndex)
  if (px <= 0) return
  const requiredScale = px / newLengthMeters
  if (isFinite(requiredScale) && requiredScale > 0) {
    if (requiredScale < store.metricsScale) {
      const newScale = Math.max(1, Math.floor(requiredScale))
      store.setMetricsScale(newScale)
    }
  }
  resizeWall(edgeIndex, newLengthMeters)
}

watch(() => store.gridSizeMeters, (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) {
    gridSizeInput.value = Number(v.toFixed(2))
  }
})

function clampToViewport(x: number, y: number, el: HTMLElement | null) {
  if (typeof window === 'undefined') return { x, y }
  const width = el?.offsetWidth ?? 200
  const height = el?.offsetHeight ?? 80
  const maxX = Math.max(0, window.innerWidth - width - 12)
  const maxY = Math.max(0, window.innerHeight - height - 12)
  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(80, y), maxY)
  }
}

function startDrag(e: MouseEvent) {
  activeDrag = 'tools'
  dragOffset = { x: e.clientX - toolboxPos.value.x, y: e.clientY - toolboxPos.value.y }
  e.preventDefault()
}

function startMetricsDrag(e: MouseEvent) {
  activeDrag = 'metrics'
  dragOffset = { x: e.clientX - metricsPos.value.x, y: e.clientY - metricsPos.value.y }
  e.preventDefault()
}

function onMove(e: MouseEvent) {
  if (!activeDrag) return
  if (activeDrag === 'tools') {
    const next = clampToViewport(e.clientX - dragOffset.x, e.clientY - dragOffset.y, toolboxRef.value)
    toolboxPos.value = next
  } else if (activeDrag === 'metrics') {
    const next = clampToViewport(e.clientX - dragOffset.x, e.clientY - dragOffset.y, metricsRef.value)
    metricsPos.value = next
  }
}

function onUp() {
  activeDrag = null
}

onMounted(() => {
  store.showMetrics = false
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
})

onBeforeUnmount(() => {
  store.showMetrics = false
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
  flex-direction: column;
  gap: 8px;
  background: rgba(10, 17, 32, 0.92);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  backdrop-filter: blur(4px);
}
.tools-row {
  display: flex;
  align-items: center;
  gap: 8px;
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

.metrics-floating {
  position: fixed;
  z-index: 2050;
  width: 260px;
  background: rgba(11,18,34,0.95);
  border: 1px solid #fbbf24;
  color: #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  font-size: 12px;
  padding-bottom: 8px;
}
.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(251,191,36,0.08);
  color: #fbbf24;
  font-weight: 700;
  cursor: grab;
}
.metrics-body { padding: 8px 10px; }
.metrics-body .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.metrics-body input,
.metrics-body select {
  background: rgba(51,65,85,0.6);
  border: 1px solid rgba(251,191,36,0.15);
  color: #fbbf24;
  border-radius: 6px;
  padding: 4px 6px;
}
.walls-list,
.doors-list {
  max-height: 160px;
  overflow: auto;
  border-top: 1px dashed rgba(255,255,255,0.05);
  padding-top: 8px;
  margin-top: 8px;
}
.walls-header,
.doors-header {
  color: #fbbf24;
  font-weight: 700;
  margin-bottom: 6px;
}
.wall-row,
.door-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
.wall-label,
.door-label {
  width: 30px;
  color: #fbbf24;
}
.wall-meter {
  flex: 1;
  text-align: right;
}

.metrics-floating {
  position: fixed;
  z-index: 2050;
  width: 260px;
  background: rgba(11,18,34,0.95);
  border: 1px solid #fbbf24;
  color: #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  font-size: 12px;
  padding-bottom: 8px;
}
.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(251,191,36,0.08);
  color: #fbbf24;
  font-weight: 700;
  cursor: grab;
}
.metrics-body { padding: 8px 10px; }
.metrics-body .row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.metrics-body input,
.metrics-body select {
  background: rgba(51,65,85,0.6);
  border: 1px solid rgba(251,191,36,0.15);
  color: #fbbf24;
  border-radius: 6px;
  padding: 4px 6px;
}
.walls-list,
.doors-list {
  max-height: 160px;
  overflow: auto;
  border-top: 1px dashed rgba(255,255,255,0.05);
  padding-top: 8px;
  margin-top: 8px;
}
.walls-header,
.doors-header {
  color: #fbbf24;
  font-weight: 700;
  margin-bottom: 6px;
}
.wall-row,
.door-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
.wall-label,
.door-label {
  width: 30px;
  color: #fbbf24;
}
.wall-meter {
  flex: 1;
  text-align: right;
}
</style>
