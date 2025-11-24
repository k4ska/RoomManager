

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
    <!-- ✅ Fallback logic -->
    <Icon v-if="isIconifyName(item.emoji)" :name="item.emoji" class="emoji" />
    <span v-else class="emoji" :class="{ image: isImageEmoji(item.emoji) }">
          <img v-if="isImageEmoji(item.emoji)" :src="item.emoji" :alt="item.label" />
          <span v-else>{{ item.emoji }}</span>

        </span>
    <span class="label">{{ item.label }}</span>
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
            <div class="drop-inner" @click="pickFile">
              <div v-if="newLogo" class="preview">
                <img :src="newLogo" alt="Logo eelvaade">
                <div class="file-name">{{ logoName }}</div>
              </div>
              <div v-else class="placeholder">
                Lohista pilt siia või klõpsa „Vali fail”.
              </div>
              <UButton size="xs" variant="outline" class="file-btn" @click.stop="pickFile">Vali fail</UButton>
            </div>
          </div>
          <UAlert v-if="logoError" color="error" title="Lisa pildifail, mida kasutada ikoonina." />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="spacer" />
      <UButton variant="ghost" @click="closeModal">Tühista</UButton>
      <UButton color="success" @click="saveCustom">Salvesta</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { StorageType } from '~/stores/storageStore'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'
import { ref, computed } from 'vue'

// Custom item inputs
const customName = ref('')
const customEmoji = ref('')


const isIconifyName = (val: string) => /^[-a-z0-9]+:[-a-z0-9]+$/i.test(val);

const store = useStorageStore()
const room = useRoomShapeStore()

type SelectorItem = { key: string; type: StorageType; label: string; emoji: string; isCustom?: boolean }

// Source list for available storage unit types

const list = [
  { type: 'box',       label: 'Kast',            emoji: 'twemoji:package' },
  { type: 'cabinet',   label: 'Kapp',            emoji: 'twemoji:file-cabinet' }, 
  { type: 'shelf',     label: 'Riiul',           emoji: 'twemoji:ladder' },       
  { type: 'chair',     label: 'Tool',            emoji: 'twemoji:chair' },         
  { type: 'drawer',    label: 'Sahtel',          emoji: 'twemoji:card-file-box' },
  { type: 'locker',    label: 'Kapp (lukuga)',   emoji: 'twemoji:locked-with-key' }, 
  { type: 'workbench', label: 'Töölaud',         emoji: 'twemoji:hammer-and-wrench' } 
] as { type: StorageType, label: string, emoji: string }[]


// Starts dragging with a JSON payload
function onDragStart(item: { type: StorageType, emoji: string }, e: DragEvent) {
  const payload = JSON.stringify({ type: item.type, emoji: item.emoji })
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

  if (typeof window !== 'undefined') {
    (window as any).__rm_redrawCanvas?.()
  }
}

// Normalize what gets stored when adding a custom item:
function normalizeEmoji(input: string) {
  // If user typed 'package' etc., default to Twemoji
  if (/^[a-z0-9-]+$/i.test(input)) return `twemoji:${input}`;
  // If they gave a full 'collection:name', keep it
  if (isIconifyName(input)) return input;
  // Otherwise it’s probably a raw Unicode emoji – keep as text (non-<Icon>)
  return input;
}

async function addCustomItem() {
  if (!customName.value || !customEmoji.value) return;

  const emoji = normalizeEmoji(customEmoji.value);
  const id = await store.addUnit('box', 40, 40, emoji);
  const unit = store.items.find(i => i.id === id);
  if (!unit) return;
  unit.name = customName.value;

  const pos = snapRectInsideRoom(unit.x, unit.y, unit.w, unit.h, unit.rotation);
  await store.updatePos(id, pos.x, pos.y);

  customName.value = '';
  customEmoji.value = '';
}




function pickFile() {
  fileInput.value?.click()
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
  closeModal()
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  max-height: calc(100vh - 140px);
  overflow: auto;
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
}
.item {
  display: flex; align-items: center; gap: 10px;
  background: rgba(148,163,184,0.12);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
}
.item:hover { 
  background: rgba(148,163,184,0.22); 
}
.emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  font-size: 1.25rem;
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
h4 {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  color: #9ca3af;
}

.custom-creator {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #334155;
}

.input-group {
  margin-bottom: 10px;
}

.input-group label {
  display: block;
  font-size: 0.85rem;
  color: #9ca3af;
  margin-bottom: 4px;
}

.input-group input {
  width: 100%;
  padding: 8px 10px;
  background: rgba(148,163,184,0.12);
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e5e7eb;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #93c5fd;
}

.emoji-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.emoji-input {
  flex: 1;
  text-align: center;
  font-size: 1.2rem !important;
}

.emoji-preview {
  width: 2rem;
  height: 2rem;
}

.add-btn {
  width: 100%;
  padding: 10px;
  background: var(--accent, #10b981);
  color: #062217;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.95rem;
}

.add-btn:hover:not(:disabled) {
  background: var(--accent-hover, #059669);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
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
</style>

