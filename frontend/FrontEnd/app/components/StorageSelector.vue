<template>
  <aside class="sidebar">
    <h3>Hoiustamise üksused</h3>
    <div class="items">
      <div
        v-for="it in list"
        :key="it.type"
        class="item"
        draggable="true"
        @dragstart="(e) => onDragStart(it, e)"
        @click="quickAdd(it)"
        :title="it.label"
      >
        <span class="emoji">{{ it.emoji }}</span>
        <span class="label">{{ it.label }}</span>
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

// Source of truth for selector + canvas
const list = [
  { type: 'box',       label: 'Kast',            emoji: '📦' },
  { type: 'cabinet',   label: 'Kapp',            emoji: '🗄️' },
  { type: 'shelf',     label: 'Riiul',           emoji: '🪜' },
  { type: 'table',     label: 'Laud',            emoji: '⛩' },
  { type: 'drawer',    label: 'Sahtel',          emoji: '🗃️' },
  { type: 'locker',    label: 'Kapp (lukuga)',   emoji: '🔒' },
  { type: 'workbench', label: 'Töölaud',         emoji: '🛠️' }
] as { type: StorageType, label: string, emoji: string }[]

function onDragStart(item: { type: StorageType, emoji: string }, e: DragEvent) {
  const payload = JSON.stringify({ type: item.type, emoji: item.emoji })
  e.dataTransfer?.setData('application/json', payload)
  e.dataTransfer?.setData('text/plain', item.type)
  e.dataTransfer?.setDragImage?.(new Image(), 0, 0)
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
  return corners.every(c => pointInPolygon(c.x, c.y, room.points))
}

function centroid(poly: {x:number;y:number}[]) {
  let x = 0, y = 0
  for (const p of poly) { x += p.x; y += p.y }
  return { x: x / poly.length, y: y / poly.length }
}

function clamp(v:number,min:number,max:number){ return Math.max(min, Math.min(max, v)) }

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

function quickAdd(item: { type: StorageType, emoji: string }) {
  const id = store.addUnit(item.type, 40, 40, item.emoji)
  const it = store.items.find(i => i.id === id)
  if (!it) return
  const pos = snapInside(it.x, it.y, it.w, it.h, it.rotation)
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
h3 { margin: 0 0 8px 0; font-size: 1.05rem; }
.items { display: grid; gap: 8px; }
.item {
  display: flex; align-items: center; gap: 10px;
  background: rgba(148,163,184,0.12);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
}
.item:hover { background: rgba(148,163,184,0.22); }
.emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  font-size: 1.25rem;
  line-height: 1;
}
.label { line-height: 1.2; }
.help { color: #9ca3af; margin-top: 10px; font-size: .9rem; }
</style>

