<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore, type StorageType } from '~/stores/storageStore'

const room = useRoomShapeStore()
const storage = useStorageStore()

const stageRef = ref<any>(null)
const layerRef = ref<any>(null)
const transformerRef = ref<any>(null)
const selectedId = ref<number | null>(null)
const hoverId = ref<number | null>(null)

const MIN = 30 // px, ~0.3m if 100px/m scale
const EMOJI_SIZE = 24 // selection box tight to emoji
const WALL_MARGIN = 2 // px margin from walls
const lastCenter = new Map<number, { x: number; y: number }>()

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function centroid(poly: {x:number;y:number}[]) {
  let x = 0, y = 0
  for (const p of poly) { x += p.x; y += p.y }
  return { x: x / poly.length, y: y / poly.length }
}

function pointInPolygon(px: number, py: number, poly: {x:number;y:number}[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function distanceToPolygonEdge(px: number, py: number, poly: {x:number;y:number}[]) {
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

function rectCornersTopLeft(x:number,y:number,w:number,h:number,deg:number){
  const cx = x + w/2, cy = y + h/2
  const rad = deg * Math.PI / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const pts = [
    {x:-w/2, y:-h/2}, {x: w/2, y:-h/2}, {x: w/2, y: h/2}, {x:-w/2, y: h/2}
  ]
  return pts.map(p => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos }))
}

function fullyInsideRoom(x:number,y:number,w:number,h:number,rot:number) {
  const corners = rectCornersTopLeft(x,y,w,h,rot)
  // Kontrolli, et kõik nurgad on ruumis JA piisavalt kaugel seinast
  for (const c of corners) {
    if (!pointInPolygon(c.x, c.y, room.points)) return false
    if (distanceToPolygonEdge(c.x, c.y, room.points) < WALL_MARGIN) return false
  }
  return true
}

function snapInside(x:number,y:number,w:number,h:number,rot:number){
  if (fullyInsideRoom(x,y,w,h,rot)) return {x,y}
  const c = centroid(room.points)
  let cx = x + w/2, cy = y + h/2
  for (let i=0;i<300;i++){
    const dirx = c.x - cx, diry = c.y - cy
    const len = Math.hypot(dirx, diry) || 1
    cx += dirx/len * 4
    cy += diry/len * 4
    const nx = cx - w/2, ny = cy - h/2
    if (fullyInsideRoom(nx,ny,w,h,rot)) return { x: nx, y: ny }
  }
  return { x: clamp(c.x - w/2, 0, room.stage.width - w), y: clamp(c.y - h/2, 0, room.stage.height - h) }
}

function findClosestValidPosition(wantedCenter:{x:number;y:number}, w:number, h:number, rot:number){
  const roomCenter = centroid(room.points)
  const dx = roomCenter.x - wantedCenter.x
  const dy = roomCenter.y - wantedCenter.y
  const dist = Math.hypot(dx, dy) || 1
  const stepX = dx / dist
  const stepY = dy / dist
  
  let cx = wantedCenter.x
  let cy = wantedCenter.y
  
  for (let step = 0; step < 200; step++) {
    const x = cx - w/2, y = cy - h/2
    if (fullyInsideRoom(x, y, w, h, rot)) {
      return { x: cx, y: cy }
    }
    cx += stepX * 2
    cy += stepY * 2
  }
  
  // Fallback - tagasta ruumi tsenter
  return { x: roomCenter.x, y: roomCenter.y }
}

onMounted(() => {
  const node = stageRef.value?.getNode?.()
  const container = node?.container?.()
  if (!container) return
  container.addEventListener('dragover', (e: DragEvent) => { e.preventDefault() })
  container.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault()
    let type = 'box' as StorageType
    let emoji: string | undefined
    const json = e.dataTransfer?.getData('application/json')
    if (json) {
      try {
        const data = JSON.parse(json)
        if (data?.type) type = data.type as StorageType
        if (typeof data?.emoji === 'string') emoji = data.emoji
      } catch {}
    } else {
      type = (e.dataTransfer?.getData('text/plain') || 'box') as StorageType
    }
    const rect = container.getBoundingClientRect()
    let x = clamp(e.clientX - rect.left, 0, room.stage.width)
    let y = clamp(e.clientY - rect.top, 0, room.stage.height)
    // place as top-left, then snap fully inside
    const id = storage.addUnit(type, x, y, emoji)
    const it = storage.items.find(i => i.id === id)!
    const pos = snapInside(it.x, it.y, it.w, it.h, it.rotation)
    storage.updatePos(id, pos.x, pos.y)
    selectedId.value = id
    attachTransformer()
    if (typeof window !== 'undefined') { (window as any).__rm_setSelected?.(id) }
  })
})

function detachTransformer(){
  const tr = transformerRef.value?.getNode?.()
  if (tr) tr.nodes([])
}

function attachTransformer(){
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

function fillFor(type: StorageType) {
  switch(type){
    case 'box': return '#38bdf8'
    case 'cabinet': return '#f59e0b'
    case 'shelf': return '#a78bfa'
    case 'table': return '#34d399'
    case 'drawer': return '#f472b6'
    case 'locker': return '#22d3ee'
    case 'workbench': return '#eab308'
  }
}

const selected = computed(() => storage.items.find(i => i.id === selectedId.value) || null)

function clearSelection(){
  selectedId.value = null
  detachTransformer()
  if (typeof window !== 'undefined') { (window as any).__rm_setSelected?.(null) }
}

function onRectClick(id:number){
  selectedId.value = id
  attachTransformer()
  if (typeof window !== 'undefined') { (window as any).__rm_setSelected?.(id) }
}

function onDragEnd(id:number, e:any, it:any){
  const node = e.target // group
  const cx = node.x(), cy = node.y()
  let x = cx - it.w/2
  let y = cy - it.h/2
  const pos = snapInside(x, y, it.w, it.h, it.rotation)
  node.x(pos.x + it.w/2); node.y(pos.y + it.h/2)
  storage.updatePos(id, pos.x, pos.y)
}

function onTransformEnd(id:number, e:any){
  const node = e.target
  const scale = node.scaleX() || 1 // keepRatio=true ensures X==Y
  const it = storage.items.find(i => i.id === id)!
  let side = Math.max(MIN, it.w * scale)
  node.scaleX(1); node.scaleY(1)
  const rot = ((node.rotation() % 360) + 360) % 360
  let x = node.x() - side/2
  let y = node.y() - side/2
  const pos = snapInside(x, y, side, side, rot)
  storage.updateUnit(id, { x: pos.x, y: pos.y, w: side, h: side, rotation: rot })
}
</script>

<template>
  <div class="canvas-wrap">
    <v-stage ref="stageRef" :config="{ width: room.stage.width, height: room.stage.height }">
      <v-layer ref="layerRef">
        <v-rect :config="{ id: 'bg', x: 0, y: 0, width: room.stage.width, height: room.stage.height, fill: '#0b1222' }" @mousedown="clearSelection" />

        <v-line
          :points="room.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.06)'"
          @mousedown="clearSelection"
        />

        <template v-for="it in storage.items" :key="it.id">
          <v-group
            :config="{
              id: `unit-${it.id}`,
              x: it.x + it.w/2,
              y: it.y + it.h/2,
              offsetX: 0,
              offsetY: 0,
              rotation: it.rotation,
              draggable: true,
              dragBoundFunc: function(pos:any){
                const wantedCenter = { x: pos.x, y: pos.y }
                const tx = wantedCenter.x - it.w/2, ty = wantedCenter.y - it.h/2
                
                if (fullyInsideRoom(tx, ty, it.w, it.h, it.rotation)) {
                  lastCenter.set(it.id, wantedCenter)
                  return wantedCenter
                }
              
                const validCenter = findClosestValidPosition(wantedCenter, it.w, it.h, it.rotation)
                lastCenter.set(it.id, validCenter)
                return validCenter
              }
            }"
            @mouseenter="() => hoverId = it.id"
            @mouseleave="() => hoverId = (hoverId===it.id?null:hoverId)"
            @click="() => onRectClick(it.id)"
            @dragend="e => onDragEnd(it.id, e, it)"
            @transformend="e => onTransformEnd(it.id, e)"
          >
            
            <v-rect :config="{
              x: -it.w/2,
              y: -it.h/2,
              width: it.w,
              height: it.h,
              cornerRadius: 8,
              fill: 'rgba(148,163,184,0.12)',
              stroke: (hoverId===it.id || selectedId===it.id) ? '#93c5fd' : '#334155',
              strokeWidth: (hoverId===it.id || selectedId===it.id) ? 2 : 1
            }" />
            <v-text :config="{ x: 0, y: 0, offsetX: EMOJI_SIZE/2, offsetY: EMOJI_SIZE/2, text: it.emoji, fontSize: EMOJI_SIZE }" />
          </v-group>
        </template>

        <v-transformer
          ref="transformerRef"
          :config="{
            rotateEnabled: true,
            enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'],
            boundBoxFunc: (oldBox:any, newBox:any) => {
              const side = Math.max(MIN, Math.max(newBox.width, newBox.height))
              return { ...newBox, width: side, height: side }
            }
          }"
        />

      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.canvas-wrap { display: flex; justify-content: center; }
</style>