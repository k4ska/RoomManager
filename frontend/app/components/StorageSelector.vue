<template>
  <aside class="sidebar">
    <h3>Hoiustamise üksused</h3>
    <div class="items">
      <div
        v-for="item in list"
        :key="item.type"
        class="item"
        draggable="true"
        @dragstart="(e) => onDragStart(item, e)"
        @click="quickAdd(item)"
        :title="item.label"
      >
        <span class="emoji">{{ item.emoji }}</span>
        <span class="label">{{ item.label }}</span>
      </div>
    </div>
    <div class="help">Lohista lõuendile või klõpsa lisamiseks.</div>
  </aside>
  
</template>

<script setup lang="ts">
import type { StorageType } from '~/stores/storageStore'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'

const store = useStorageStore()
const room = useRoomShapeStore()

// Source list for available storage unit types
const list = [
  { type: 'box',       label: 'Kast',            emoji: '📦' },
  { type: 'cabinet',   label: 'Kapp',            emoji: '🗄️' },
  { type: 'shelf',     label: 'Riiul',           emoji: '🪜' },
  { type: 'table',     label: 'Laud',            emoji: '⛩' },
  { type: 'drawer',    label: 'Sahtel',          emoji: '🗃️' },
  { type: 'locker',    label: 'Kapp (lukuga)',   emoji: '🔒' },
  { type: 'workbench', label: 'Töölaud',         emoji: '🛠️' }
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
function quickAdd(item: { type: StorageType, emoji: string }) {
  const id = store.addUnit(item.type, 40, 40, item.emoji)
  const unit = store.items.find(i => i.id === id)
  if (!unit) return
  const pos = snapRectInsideRoom(unit.x, unit.y, unit.w, unit.h, unit.rotation)
  store.updatePos(id, pos.x, pos.y)
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
h3 { 
  margin: 0 0 8px 0; 
  font-size: 1.05rem; 
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
  width: 1.6rem;
  height: 1.6rem;
  font-size: 1.25rem;
  line-height: 1;
}
.label { 
  line-height: 1.2; 
}
.help { 
  color: #9ca3af; 
  margin-top: 10px; 
  font-size: .9rem; 
}
</style>

