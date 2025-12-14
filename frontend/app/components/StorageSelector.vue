<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <h3>Hoiustamise üksused</h3>
      <button class="add-btn" type="button" @click="openModal = true">Lisa uus</button>
    </div>
    <div class="items">
      <div
        v-for="item in allItems"
        :key="item.key"
        class="item"
        draggable="true"
        @dragstart="(e) => onDragStart(item, e)"
        @click="quickAdd(item)"
        :title="item.label"
      >
        <div class="item-main">
          <span class="emoji" :class="{ image: isImageEmoji(item.emoji) }">
            <img v-if="isImageEmoji(item.emoji)" :src="item.emoji" :alt="item.label" />
            <span v-else>{{ item.emoji }}</span>
          </span>
          <span class="label">{{ item.label }}</span>
        </div>
        <button
          v-if="item.isCustom"
          class="delete-btn"
          title="Kustuta"
          @click.stop="confirmDelete(item.key)"
        >🗑️</button>
      </div>
    </div>
    <div class="help">Lohista lõuendile või klõpsa lisamiseks.</div>
  </aside>

  <UModal v-model:open="openModal" title="Lisa uus üksus" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="modal-fields">
        <div class="field">
          <label class="field-label">Üksuse nimi *</label>
          <UInput v-model="newName" placeholder="Minu eriline kast" />
          <UAlert v-if="nameError" color="error" title="Nimi on kohustuslik." />
        </div>

        <div class="field">
          <label class="field-label">Logo / ikoon *</label>
          <div
            class="dropzone"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
                  <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="onFileChange">
                  <input ref="captureInput" type="file" class="hidden" accept="image/*" capture="environment" @change="onFileChange">
            <div class="drop-inner" @click="pickFile">
              <div v-if="newLogo" class="preview">
                <img :src="newLogo" alt="Logo eelvaade">
                <div class="file-name">{{ logoName }}</div>
              </div>
              <div v-else class="placeholder">
                Klõpsa „Vali fail” või tee Kaameraga pilt.
              </div>
                    <div style="display:flex;gap:8px;align-items:center">
                      <UButton size="xs" variant="outline" class="file-btn" @click.stop="pickFile">Vali fail</UButton>
                      <UButton size="xs" variant="outline" class="file-btn" @click.stop="openCamera">Kaamera</UButton>
                    </div>
            </div>
          </div>
          <UAlert v-if="logoError" color="error" title="Lisa pildifail, mida kasutada ikoonina." />

          <!-- Camera overlay for live capture -->
          <div v-if="showCamera" class="camera-overlay">
            <div class="camera-inner">
              <video ref="videoRef" class="camera-video" autoplay playsinline muted></video>
              <div class="camera-controls">
                <UButton size="sm" color="success" @click="captureFromCamera">Tee pilt</UButton>
                <UButton size="sm" variant="ghost" @click="stopCamera">Tühista</UButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="spacer" />
      <UButton variant="ghost" @click="closeModal">Tühista</UButton>
      <UButton color="success" @click="saveCustom">Salvesta</UButton>
    </template>
  </UModal>

  <UModal v-model:open="deleteOpen" title="Kustuta üksus?" :ui="{ footer: 'justify-end' }">
    <template #body>
      <p>Seda toimingut ei saa tagasi võtta.</p>
    </template>
    <template #footer="{ close }">
      <UButton variant="ghost" @click="deleteOpen=false; deleteKey=null; close()">Tühista</UButton>
      <UButton color="error" @click="applyDelete">Kustuta</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import type { StorageType } from '~/stores/storageStore'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'

const store = useStorageStore()
const room = useRoomShapeStore()

type SelectorItem = { key: string; type: StorageType; label: string; emoji: string; isCustom?: boolean }

// Source list for available storage unit types
const baseItems: SelectorItem[] = [
  { key: 'builtin-box',       type: 'box',       label: 'Kast',            emoji: '📦' },
  { key: 'builtin-cabinet',   type: 'cabinet',   label: 'Kapp',            emoji: '🗄️' },
  { key: 'builtin-shelf',     type: 'shelf',     label: 'Riiul',           emoji: '🪜' },
  { key: 'builtin-table',     type: 'table',     label: 'Laud',            emoji: '⛩' },
  { key: 'builtin-drawer',    type: 'drawer',    label: 'Sahtel',          emoji: '🗃️' },
  { key: 'builtin-locker',    type: 'locker',    label: 'Kapp (lukuga)',   emoji: '🔒' },
  { key: 'builtin-workbench', type: 'workbench', label: 'Töölaud',         emoji: '🛠️' }
] as const

const customItems = ref<SelectorItem[]>([])
const allItems = computed(() => [...baseItems, ...customItems.value])
const openModal = ref(false)
const newName = ref('')
const newLogo = ref<string | null>(null)
const logoName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const captureInput = ref<HTMLInputElement | null>(null)
const nameError = ref(false)
const logoError = ref(false)
const showCamera = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let streamRef: MediaStream | null = null
const deleteOpen = ref(false)
const deleteKey = ref<string | null>(null)

// Load custom items from localStorage on init
function loadCustomItems() {
  try {
    const stored = localStorage.getItem('storageSelector_customItems')
    if (stored) {
      customItems.value = JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load custom items:', e)
  }
}

// Save custom items to localStorage
function saveCustomItemsToStorage() {
  try {
    localStorage.setItem('storageSelector_customItems', JSON.stringify(customItems.value))
  } catch (e) {
    console.error('Failed to save custom items:', e)
  }
}

// Load on mount
onMounted(() => {
  loadCustomItems()
})

watch(newName, (v) => { if (v.trim()) nameError.value = false })
watch(newLogo, (v) => { if (v) logoError.value = false })
watch(openModal, (v) => { if (!v) { resetForm(); stopCamera() } })
watch(customItems, (v) => { saveCustomItemsToStorage() }, { deep: true })

function resetForm() {
  newName.value = ''
  newLogo.value = null
  logoName.value = ''
  nameError.value = false
  logoError.value = false
}

function closeModal() {
  openModal.value = false
  resetForm()
}

function confirmDelete(key: string) {
  deleteKey.value = key
  deleteOpen.value = true
}

function applyDelete() {
  if (!deleteKey.value) { deleteOpen.value = false; return }
  customItems.value = customItems.value.filter(i => i.key !== deleteKey.value)
  deleteKey.value = null
  deleteOpen.value = false
}

function isImageEmoji(value: string) {
  return value.startsWith('data:image') || value.startsWith('http')
}

function onDragStart(item: SelectorItem, e: DragEvent) {
  const payload = JSON.stringify({ type: item.type, emoji: item.emoji, name: item.label })
  e.dataTransfer?.setData('application/json', payload)
  e.dataTransfer?.setData('text/plain', item.type)
  e.dataTransfer?.setDragImage?.(new Image(), 0, 0)
}

// Checks if a point is inside a polygon using ray-casting
function isPointInsidePolygon(px: number, py: number, poly: {x:number;y:number}[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const crosses = (yi > py) !== (yj > py)
    const atLeft = px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi
    if (crosses && atLeft) inside = !inside
  }
  return inside
}

// Returns rectangle corner points (from top-left), respecting rotation
function getRectCornersFromTopLeft(x:number,y:number,w:number,h:number,deg:number){
  const cx = x + w/2
  const cy = y + h/2
  const rad = deg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const pts = [
    {x:-w/2, y:-h/2}, {x: w/2, y:-h/2}, {x: w/2, y: h/2}, {x:-w/2, y: h/2}
  ]
  return pts.map(p => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }))
}

// Checks if a rotated rectangle is fully inside the room polygon
function isRectFullyInsideRoom(x:number,y:number,w:number,h:number,rot:number) {
  const corners = getRectCornersFromTopLeft(x,y,w,h,rot)
  return corners.every(c => isPointInsidePolygon(c.x, c.y, room.points))
}

// Returns the center point of a polygon
function getPolygonCenter(poly: {x:number;y:number}[]) {
  let x = 0, y = 0
  for (const p of poly) { x += p.x; y += p.y }
  return { x: x / poly.length, y: y / poly.length }
}

// Returns value clamped between min and max
function clampValue(v:number,min:number,max:number){ return Math.max(min, Math.min(max, v)) }

// Moves a rectangle inside the room if needed, returns top-left
function snapRectInsideRoom(x:number,y:number,w:number,h:number,rot:number){
  if (isRectFullyInsideRoom(x,y,w,h,rot)) return {x,y}
  const c = getPolygonCenter(room.points)
  let cx = x + w/2, cy = y + h/2
  for (let i=0;i<300;i++){
    const dirx = c.x - cx, diry = c.y - cy
    const len = Math.hypot(dirx, diry) || 1
    cx += dirx/len * 4
    cy += diry/len * 4
    const nx = cx - w/2, ny = cy - h/2
    if (isRectFullyInsideRoom(nx,ny,w,h,rot)) return { x: nx, y: ny }
  }
  return { x: clampValue(c.x - w/2, 0, room.stage.width - w), y: clampValue(c.y - h/2, 0, room.stage.height - h) }
}

// Quickly adds a unit and snaps it inside the room
async function quickAdd(item: SelectorItem) {
  const id = await store.addUnit(item.type, 40, 40, item.emoji, item.label)
  const unit = store.items.find(i => i.id === id)
  if (!unit) return
  const pos = snapRectInsideRoom(unit.x, unit.y, unit.w, unit.h, unit.rotation)
  await store.updatePos(id, pos.x, pos.y)
}

function pickFile() {
  fileInput.value?.click()
}

async function openCamera() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      streamRef = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      showCamera.value = true
      await nextTick()
      if (videoRef.value) {
        videoRef.value.srcObject = streamRef
        await videoRef.value.play()
      }
      return
    } catch (e) {
      // fallback to file capture input below
    }
  }
  // mobile fallback: trigger capture-enabled file input
  captureInput.value?.click()
}

function stopCamera() {
  try {
    if (streamRef) {
      streamRef.getTracks().forEach(t => t.stop())
      streamRef = null
    }
  } catch (e) {}
  showCamera.value = false
  if (videoRef.value) videoRef.value.srcObject = null
}

function captureFromCamera() {
  if (!videoRef.value) return
  const v = videoRef.value
  const w = v.videoWidth || 640
  const h = v.videoHeight || 480
  if (!canvasRef.value) {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    canvasRef.value = c
  } else {
    canvasRef.value.width = w; canvasRef.value.height = h
  }
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  ctx.drawImage(v, 0, 0, w, h)
  const data = canvasRef.value.toDataURL('image/png')
  newLogo.value = data
  logoName.value = `camera-${Date.now()}.png`
  logoError.value = false
  stopCamera()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  handleFile(target.files?.[0])
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  handleFile(file)
}

function handleFile(file?: File) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    newLogo.value = null
    logoName.value = ''
    logoError.value = true
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    newLogo.value = typeof reader.result === 'string' ? reader.result : null
    logoName.value = file.name
    logoError.value = false
  }
  reader.readAsDataURL(file)
}

function saveCustom() {
  nameError.value = !newName.value.trim()
  logoError.value = !newLogo.value
  if (nameError.value || logoError.value) return
  const label = newName.value.trim()
  customItems.value.push({
    key: `custom-${Date.now()}-${customItems.value.length}`,
    type: 'box',
    label,
    emoji: newLogo.value!,
    isCustom: true
  })
  saveCustomItemsToStorage()
  closeModal()
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  max-height: calc(100vh - 220px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 12px;
  background: rgba(15,23,42,0.85);
  box-sizing: border-box;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
h3 { 
  margin: 0; 
  font-size: 1.05rem; 
}
.add-btn {
  border: 1px solid #334155;
  background: rgba(52, 211, 153, 0.1);
  color: #10b981;
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}
.items {
  display: grid;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  background: rgba(148,163,184,0.12);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
  justify-content: space-between;
}
.item-main { display: flex; align-items: center; gap: 10px; }
.item:hover { 
  background: rgba(148,163,184,0.22); 
}
.emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  min-height: 2.5rem;
  font-size: 1.8rem;
  line-height: 1;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(15,23,42,0.6);
}
.emoji.image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.label { 
  line-height: 1.2; 
}
.delete-btn {
  border: 1px solid #7f1d1d;
  background: rgba(244,63,94,0.12);
  color: #fca5a5;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.item:hover .delete-btn { opacity: 1; }
.help { 
  color: #9ca3af; 
  margin-top: 10px; 
  font-size: .9rem; 
}
.modal-fields {
  display: grid;
  gap: 16px;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}
.dropzone {
  border: 1px dashed #334155;
  border-radius: 12px;
  background: rgba(51, 65, 85, 0.3);
}
.drop-inner {
  display: grid;
  gap: 10px;
  align-items: center;
  justify-items: start;
  padding: 12px;
  cursor: pointer;
}
.placeholder {
  color: #cbd5e1;
}
.preview img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #334155;
}
.file-name {
  margin-top: 4px;
  color: #e5e7eb;
  font-size: 0.9rem;
}
.file-btn {
  justify-self: end;
}
.spacer { flex: 1; }
.hidden { display: none; }

/* Camera overlay styles */
.camera-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2,6,23,0.6);
  z-index: 60;
  border-radius: 10px;
}
.camera-inner {
  background: #0b1222;
  border: 1px solid #334155;
  padding: 12px;
  border-radius: 8px;
  display:flex;
  flex-direction:column;
  gap:8px;
  align-items:center;
}
.camera-video { width:320px; height:240px; background:#000; border-radius:6px; object-fit:cover }
.camera-controls { display:flex; gap:8px }
</style>

