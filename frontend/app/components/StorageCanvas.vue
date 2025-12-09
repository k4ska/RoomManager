<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore, type StorageType } from '~/stores/storageStore'

const room = useRoomShapeStore()
const storage = useStorageStore()

const stageRef = ref<any>(null)
const layerRef = ref<any>(null)
const transformerRef = ref<any>(null)
const selectedId = ref<number | null>(null)
const selectedIds = ref<number[]>([])
const hoverId = ref<number | null>(null)
const imageCache = new Map<string, HTMLImageElement | null>()

const MIN = 30 // minimum side length in pixels
const PADDING = 4 //emoji ümber ruum
const WALL_MARGIN = 2 // minimum distance from walls in pixels
const DELETE_BTN_SIZE = 24 // size of delete button

// Tagastab väärtuse piiratud vahemikus [min, max]
function clampValue(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function isImageEmoji(value: string | undefined | null) {
  return !!value && (value.startsWith('data:image') || value.startsWith('http'))
}

function getImage(value: string | undefined | null) {
  if (!isImageEmoji(value)) return null
  if (typeof Image === 'undefined') return null
  if (!imageCache.has(value!)) {
    const img = new Image()
    img.src = value!
    imageCache.set(value!, img)
  }
  return imageCache.get(value!) || null
}

// Tagastab hulknurga keskpunkti
function getPolygonCenter(poly: { x: number; y: number }[]) {
  let x = 0
  let y = 0
  for (const p of poly) {
    x += p.x
    y += p.y
  }
  return { x: x / poly.length, y: y / poly.length }
}

// Kontrollib, kas punkt asub hulknurga sees (ray-casting)
function isPointInsidePolygon(px: number, py: number, poly: { x: number; y: number }[]) {
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

// Tagastab lühima kauguse punktist hulknurga servadeni
function getDistanceToPolygon(px: number, py: number, poly: { x: number; y: number }[]) {
  let minDist = Infinity
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    const x1 = poly[i].x, y1 = poly[i].y
    const x2 = poly[j].x, y2 = poly[j].y
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    let t = ((px - x1) * dx + (py - y1) * dy) / (len2 || 1e-9)
    t = Math.max(0, Math.min(1, t))
    const projX = x1 + t * dx, projY = y1 + t * dy
    const dist = Math.hypot(px - projX, py - projY)
    minDist = Math.min(minDist, dist)
  }
  return minDist
}

// Tagastab ristküliku nurgapunktid (ülemisest vasakust), arvestades pöördenurka
function getRectCornersFromTopLeft(x: number, y: number, w: number, h: number, deg: number) {
  const cx = x + w / 2
  const cy = y + h / 2
  const rad = deg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const points = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 }
  ]
  return points.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos
  }))
}

// Kontrollib, kas pööratud ristkülik on täielikult ruumi sees ja eemale seintest
function isRectFullyInsideRoom(x: number, y: number, w: number, h: number, rot: number) {
  const corners = getRectCornersFromTopLeft(x, y, w, h, rot)
  for (const c of corners) {
    if (!isPointInsidePolygon(c.x, c.y, room.points)) return false
    if (getDistanceToPolygon(c.x, c.y, room.points) < WALL_MARGIN) return false
  }
  return true
}

// Liigutab ristküliku vajadusel ruumi sisse; tagastab ülemise vasaku nurga
function snapRectInsideRoom(x: number, y: number, w: number, h: number, rot: number) {
  if (isRectFullyInsideRoom(x, y, w, h, rot)) return { x, y }
  const center = getPolygonCenter(room.points)
  let cx = x + w / 2
  let cy = y + h / 2
  for (let i = 0; i < 300; i++) {
    const dirx = center.x - cx
    const diry = center.y - cy
    const len = Math.hypot(dirx, diry) || 1
    cx += (dirx / len) * 4
    cy += (diry / len) * 4
    const nx = cx - w / 2
    const ny = cy - h / 2
    if (isRectFullyInsideRoom(nx, ny, w, h, rot)) return { x: nx, y: ny }
  }
  return {
    x: clampValue(center.x - w / 2, 0, room.stage.width - w),
    y: clampValue(center.y - h / 2, 0, room.stage.height - h)
  }
}

// Leiab lohistamise ajal lähima kehtiva keskpunkti ruumis
function findClosestCenterInsideRoom(wantedCenter: { x: number; y: number }, w: number, h: number, rot: number) {
  const roomCenter = getPolygonCenter(room.points)
  const dx = roomCenter.x - wantedCenter.x
  const dy = roomCenter.y - wantedCenter.y
  const dist = Math.hypot(dx, dy) || 1
  const stepX = dx / dist
  const stepY = dy / dist

  let cx = wantedCenter.x
  let cy = wantedCenter.y

  for (let step = 0; step < 200; step++) {
    const x = cx - w / 2
    const y = cy - h / 2
    if (isRectFullyInsideRoom(x, y, w, h, rot)) return { x: cx, y: cy }
    cx += stepX * 2
    cy += stepY * 2
  }

  return { x: roomCenter.x, y: roomCenter.y }
}

// Deletes an item
async function deleteItem(id: number) {
  await storage.removeUnit(id)
  
  selectedIds.value = selectedIds.value.filter(i => i !== id)
  
  if (selectedId.value === id) {
    selectedId.value = selectedIds.value[0] || null
    if (selectedId.value) {
      attachTransformer()
    } else {
      detachTransformer()
    }
  }
  
  if (hoverId.value === id) {
    hoverId.value = null
  }
  
  if (typeof window !== 'undefined') {
  const setSelected = (window as any).__rm_setSelected
  const setSelectedIds = (window as any).__rm_setSelectedIds
  if (setSelected) setSelected(selectedId.value)
  if (setSelectedIds) setSelectedIds(selectedIds.value)
}
}

// Sets up drag-and-drop for adding new items to the canvas
onMounted(() => {
  const node = stageRef.value?.getNode?.()
  const container = node?.container?.()
  if (!container) return

  container.addEventListener('dragover', (e: DragEvent) => e.preventDefault())
  container.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault()
    let type = 'box' as StorageType
    let emoji: string | undefined
    let name: string | undefined

    const json = e.dataTransfer?.getData('application/json')
    if (json) {
      try {
        const data = JSON.parse(json)
        if (data?.type) type = data.type as StorageType
        if (typeof data?.emoji === 'string') emoji = data.emoji
        if (typeof data?.name === 'string') name = data.name
      } catch {}
    } else {
      type = (e.dataTransfer?.getData('text/plain') || 'box') as StorageType
    }

    const rect = container.getBoundingClientRect()
    const x = clampValue(e.clientX - rect.left, 0, room.stage.width)
    const y = clampValue(e.clientY - rect.top, 0, room.stage.height)

    // Place by top-left, then snap fully inside the room
    const id = await storage.addUnit(type, x, y, emoji, name)
    const item = storage.items.find(i => i.id === id)!
    const pos = snapRectInsideRoom(item.x, item.y, item.w, item.h, item.rotation)
    await storage.updatePos(id, pos.x, pos.y)
    selectedId.value = id
    selectedIds.value = [id]
    attachTransformer()
    if (typeof window !== 'undefined') {
    const setSelected = (window as any).__rm_setSelected
    const setSelectedIds = (window as any).__rm_setSelectedIds
    if (setSelected) setSelected(selectedId.value)
    if (setSelectedIds) setSelectedIds(selectedIds.value)
}
  })
})

// Eemaldab transformer’i kõikidelt sõlmedelt
function detachTransformer() {
  const tr = transformerRef.value?.getNode?.()
  if (tr) tr.nodes([])
}

// Seob transformer’i valitud sõlmega
function attachTransformer(id?: number) {
  const layer = layerRef.value?.getNode?.()
  const tr = transformerRef.value?.getNode?.()
  if (!layer || !tr) return
  const node = layer.findOne(`#unit-${selectedId.value}`)
  if (node) {
    tr.nodes([node])
    tr.keepRatio(true)
    tr.moveToTop()
    layer.draw()
  }
}

// Tühjendab praeguse valiku
function clearSelection() {
  selectedId.value = null
  selectedIds.value = []
  detachTransformer()
  if (typeof window !== 'undefined') {
  const setSelected = (window as any).__rm_setSelected
  const setSelectedIds = (window as any).__rm_setSelectedIds
  if (setSelected) setSelected(selectedId.value)
  if (setSelectedIds) setSelectedIds(selectedIds.value)
}
}

/* Valib üksuse ID alusel
function onRectClick(id: number) {
  selectedId.value = id
  attachTransformer()
  if (typeof window !== 'undefined') (window as any).__rm_setSelected?.(id)
}
*/

function onRectClick(id: number, evt: {evt: MouseEvent}) {
  console.log('onRectClick called with id:', id)
  console.log('Current selectedIds:', selectedIds.value)
  const e = evt.evt as MouseEvent

  // Toggle selection - click to select/deselect
  if (selectedIds.value.includes(id)) {
    // Deselect this item
    selectedIds.value = selectedIds.value.filter(i => i !== id)
    if (selectedId.value === id) {
      selectedId.value = selectedIds.value[0] || null
      if (selectedId.value) {
        attachTransformer()
      } else {
        detachTransformer()
      }
    }
  } else {
    // Add to selection
    selectedIds.value.push(id)
    selectedId.value = id
    attachTransformer()
  }
  
  if (typeof window !== 'undefined') {
  const setSelected = (window as any).__rm_setSelected
  const setSelectedIds = (window as any).__rm_setSelectedIds
  if (setSelected) setSelected(selectedId.value)
  if (setSelectedIds) setSelectedIds(selectedIds.value)
}
}

// Uuendab üksuse asukohta peale lohistamise lõppu
function onDragEnd(id: number, e: {target:any}, item: any) {
  const node = e.target
  const cx = node.x()
  const cy = node.y()
  const x = cx - item.w / 2
  const y = cy - item.h / 2
  const pos = snapRectInsideRoom(x, y, item.w, item.h, item.rotation)
  node.x(pos.x + item.w / 2)
  node.y(pos.y + item.h / 2)
  storage.updatePos(id, pos.x, pos.y)
}

// Jalgib reaalajas, et suurendatav yksus ei lahkuks ruumist
function onTransform(id: number, e: any) {
  const node = e.target
  const item = storage.items.find(i => i.id === id)
  if (!item) return
  const scale = node.scaleX() || 1
  const side = Math.max(MIN, item.w * scale)
  const rot = ((node.rotation() % 360) + 360) % 360
  const x = node.x() - side / 2
  const y = node.y() - side / 2
  if (!isRectFullyInsideRoom(x, y, side, side, rot)) {
    const prev = (node as any)._rmLastScale ?? 1
    node.scaleX(prev)
    node.scaleY(prev)
    return
  }
  (node as any)._rmLastScale = scale
}

// Uuendab suuruse ja pöördenurga peale transformatsiooni lõppu
function onTransformEnd(id: number, e: any) {
  const node = e.target
  const scale = node.scaleX() || 1
  const item = storage.items.find(i => i.id === id)!
  const side = Math.max(MIN, item.w * scale)
  node.scaleX(1)
  node.scaleY(1)
  ;(node as any)._rmLastScale = 1
  const rot = ((node.rotation() % 360) + 360) % 360
  const x = node.x() - side / 2
  const y = node.y() - side / 2
  const pos = snapRectInsideRoom(x, y, side, side, rot)
  node.x(pos.x + side / 2)
  node.y(pos.y + side / 2)
  storage.updateUnit(id, { x: pos.x, y: pos.y, w: side, h: side, rotation: rot })
}
</script>

<template>
  <div class="canvas-wrap">
    <v-stage ref="stageRef" :config="{
        width: room.stage.width,
        height: room.stage.height
      }">
      <v-layer ref="layerRef">
        <v-rect :config="{
            id: 'bg',
            x: 0,
            y: 0,
            width: room.stage.width,
            height: room.stage.height,
            fill: '#0b1222'
          }" @mousedown="clearSelection" />

        <v-line
          :points="room.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.06)'"
          @mousedown="clearSelection"
        />

        <template v-for="item in storage.items" :key="item.id">
          <v-group
            :config="{
              id: `unit-${item.id}`,
              x: item.x + item.w/2,
              y: item.y + item.h/2,
              offsetX: 0,
              offsetY: 0,
              rotation: item.rotation,
              draggable: true,
              dragBoundFunc: function(pos:any){
                const wantedCenter = { x: pos.x, y: pos.y }
                const tx = wantedCenter.x - item.w/2
                const ty = wantedCenter.y - item.h/2

                if (isRectFullyInsideRoom(tx, ty, item.w, item.h, item.rotation)) {
                  return wantedCenter
                }

                const validCenter = findClosestCenterInsideRoom(wantedCenter, item.w, item.h, item.rotation)
                return validCenter
              }
            }"
            @mouseenter="() => hoverId = item.id"
            @mouseleave="() => hoverId = (hoverId===item.id?null:hoverId)"
            @click="(e: any) => onRectClick(item.id, e)"
            @dragend="(e: any) => onDragEnd(item.id, e, item)"
            @transform="(e: any) => onTransform(item.id, e)"
            @transformend="(e: any) => onTransformEnd(item.id, e)"
          >
            
            <v-rect :config="{
              x: -item.w/2,
              y: -item.h/2,
              width: item.w,
              height: item.h,
              cornerRadius: 8,
              fill: 'rgba(148,163,184,0.12)',
              stroke: (hoverId===item.id || selectedIds.includes(item.id)) ? '#93c5fd' : '#334155',
              strokeWidth: (hoverId===item.id || selectedIds.includes(item.id)) ? 2 : 1
            }" />

            <v-image
              v-if="isImageEmoji(item.emoji)"
              :config="{
                x: -item.w/2,
                y: -item.h/2,
                width: item.w,
                height: item.h,
                image: getImage(item.emoji) || undefined,
                listening: false
              }"
            />
            <v-text
              v-else
              :config="{
                x: -item.w/2,
                y: -item.h/2,
                width: item.w,
                height: item.h,
                align: 'center',
                verticalAlign: 'middle',
                text: item.emoji,
                fontSize: Math.max(20, Math.min(item.w, item.h) * 0.7),
                fill: '#ffffff'
              }"
            />

            <v-group
              v-if="hoverId === item.id"
              :config="{
                x: item.w/2 - DELETE_BTN_SIZE/2,
                y: -item.h/2 - DELETE_BTN_SIZE/2,
                listening: true
              }"
              @click="(e : any) => { e.cancelBubble = true; deleteItem(item.id); }"
              @tap="(e: any) => { e.cancelBubble = true; deleteItem(item.id); }"
              @mousedown="(e: any) => e.cancelBubble = true"
              @touchstart="(e: any) => e.cancelBubble = true"
            >
              <v-circle :config="{
              x: 0,
              y: 0,
              radius: DELETE_BTN_SIZE/2,
              fill: '#ef4444',
              stroke: '#ffffff',
              strokeWidth: 2,
              shadowColor: '#000000',
              shadowBlur: 4,
              shadowOpacity: 0.3,
              listening: true
            }" 
            @mouseenter="(e: any) => { e.target.fill('#dc2626'); e.target.getLayer().batchDraw(); }"
            @mouseleave="(e: any) => { e.target.fill('#ef4444'); e.target.getLayer().batchDraw(); }"
            />
              
              <v-text :config="{
                x: -DELETE_BTN_SIZE/2,
                y: -DELETE_BTN_SIZE/2,
                width: DELETE_BTN_SIZE,
                height: DELETE_BTN_SIZE,
                text: '✕',
                fontSize: 16,
                fontStyle: 'bold',
                fill: '#ffffff',
                align: 'center',
                verticalAlign: 'middle',
                listening: false
              }" />
              
            </v-group>
          </v-group>
        </template>

        <v-transformer
          ref="transformerRef"
          :config="{
            rotateEnabled: true,
            enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'],
            boundBoxFunc: (oldBox:any, newBox:any) => {
              const rawWidth = Math.abs(newBox.width)
              const rawHeight = Math.abs(newBox.height)
              const side = Math.max(MIN, Math.max(rawWidth, rawHeight))
              const centerX = newBox.x + (newBox.width / 2)
              const centerY = newBox.y + (newBox.height / 2)
              const topLeftX = centerX - side / 2
              const topLeftY = centerY - side / 2
              const rotation = typeof newBox.rotation === 'number' ? newBox.rotation : (oldBox.rotation || 0)
              // Takistab, et kasutaja ei venitaks yksust ruumi piiridest valja
              if (!isRectFullyInsideRoom(topLeftX, topLeftY, side, side, rotation)) {
                return oldBox
              }
              const widthSign = newBox.width >= 0 ? 1 : -1
              const heightSign = newBox.height >= 0 ? 1 : -1
              return { ...newBox, width: widthSign * side, height: heightSign * side }
            }
          }"
        />

      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.canvas-wrap { 
  display: flex; 
  justify-content: center; 
}
</style>
