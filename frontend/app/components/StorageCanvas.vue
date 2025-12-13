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

// Helpers for window rendering (so windows show on the storage canvas)
function getWindowPerp(p1: {x:number,y:number}, p2: {x:number,y:number}) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  return { ux, uy, nx, ny }
}

function capPointsAt(p: {x:number,y:number}, nx: number, ny: number, capLen: number) {
  const half = capLen / 2
  return [p.x - nx * half, p.y - ny * half, p.x + nx * half, p.y + ny * half]
}

// Map room.windows (edge-relative) to real coordinates so windows follow walls
const windowsWithPoints = computed(() => {
  try {
    return (room.windows || []).map((w: any, idx: number) => {
      const a = room.points[w.edgeIndex]
      const b = room.points[(w.edgeIndex + 1) % room.points.length]
      if (!a || !b) return { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, index: idx }
      const p1 = { x: a.x + (b.x - a.x) * (w.t1 ?? 0), y: a.y + (b.y - a.y) * (w.t1 ?? 0) }
      const p2 = { x: a.x + (b.x - a.x) * (w.t2 ?? 0), y: a.y + (b.y - a.y) * (w.t2 ?? 0) }
      return { p1, p2, index: idx }
    })
  } catch {
    return []
  }
})

// Map room.doors (edge-relative) to real coordinates with L-junction and curved line
const doorsWithPoints = computed(() => {
  try {
    return (room.doors || []).map((d: any, idx: number) => {
      const a = room.points[d.edgeIndex]
      const b = room.points[(d.edgeIndex + 1) % room.points.length]
      if (!a || !b) return { ...d, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, index: idx }
      
      // Door opening endpoints on edge
      const p1 = { x: a.x + (b.x - a.x) * (d.t1 ?? 0), y: a.y + (b.y - a.y) * (d.t1 ?? 0) }
      const p2 = { x: a.x + (b.x - a.x) * (d.t2 ?? 0), y: a.y + (b.y - a.y) * (d.t2 ?? 0) }
      
      // Perpendicular direction (LEFT of p1->p2)
      const edgePerp = getWindowPerp(p1, p2)
      const capLen = 18

      // INSIDE: LEFT (room), OUTSIDE: RIGHT (mirror)
      const isInside = (d.direction || room.doorDirection) === 'inside'
      const nx = isInside ? edgePerp.nx : -edgePerp.nx
      const ny = isInside ? edgePerp.ny : -edgePerp.ny

      const lJuncVertStart = p1
      const lJuncVertEnd = { x: p2.x, y: p2.y }
      const lJuncCapEnd = { x: p1.x + nx * capLen, y: p1.y + ny * capLen }

      
      // Curved line from lJuncCapEnd to p2 using quadratic bezier with control point pulling curve outward,
      // but never going further outward than the L tip horizontally. Clamp endpoint to wall segment.
      const curvePoints = []
      const midX = (lJuncCapEnd.x + p2.x) / 2
      const midY = (lJuncCapEnd.y + p2.y) / 2
      const outward = { nx: edgePerp.nx, ny: edgePerp.ny }
      let cpOffset = 18
      const vecToMid = { x: midX - lJuncCapEnd.x, y: midY - lJuncCapEnd.y }
      const proj = vecToMid.x * nx + vecToMid.y * ny      // ← edgePerp → nx/ny
      const cpx = midX + nx * cpOffset                    // ← edgePerp → nx
      const cpy = midY + ny * cpOffset                    // ← edgePerp → ny

      // Clamp endpoint to wall segment
      const clampToWall = (x, y) => {
        // Project onto wall segment (p1 to p2)
        const dx = p2.x - p1.x, dy = p2.y - p1.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) return { x: p1.x, y: p1.y }
        let t = ((x - p1.x) * dx + (y - p1.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        return { x: p1.x + t * dx, y: p1.y + t * dy }
      }
      for (let t = 0; t <= 1; t += 0.05) {
        const tt = t * t
        const mt = 1 - t
        const mtt = mt * mt
        let px = mtt * lJuncCapEnd.x + 2 * mt * t * cpx + tt * p2.x
        let py = mtt * lJuncCapEnd.y + 2 * mt * t * cpy + tt * p2.y
        // Clamp last point to wall
        if (t === 1) {
          const clamped = clampToWall(px, py)
          px = clamped.x; py = clamped.y
        }
        curvePoints.push(px, py)
      }
      
      return { ...d, p1, p2, lJuncVertStart, lJuncVertEnd, lJuncCapEnd, curvePoints, index: idx }
    })
  } catch {
    return []
  }
})

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

// --- Collision helpers ---
function rectAABB(x: number, y: number, w: number, h: number, rot: number) {
  const corners = getRectCornersFromTopLeft(x, y, w, h, rot)
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY
  for (const c of corners) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  return { minX, minY, maxX, maxY }
}

function aabbOverlap(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY)
}

function isOverlappingAny(x: number, y: number, w: number, h: number, rot: number, ignoreId?: number) {
  const a = rectAABB(x, y, w, h, rot)
  for (const it of storage.items) {
    if (ignoreId && it.id === ignoreId) continue
    const b = rectAABB(it.x, it.y, it.w, it.h, it.rotation || 0)
    if (aabbOverlap(a, b)) return true
  }
  return false
}

// Find nearest center that is inside room and doesn't overlap existing items.
function findClosestNonOverlappingCenter(wantedCenter: { x: number; y: number }, w: number, h: number, rot: number, ignoreId?: number) {
  // If wanted center is valid, return it
  const topLeft = { x: wantedCenter.x - w / 2, y: wantedCenter.y - h / 2 }
  if (isRectFullyInsideRoom(topLeft.x, topLeft.y, w, h, rot) && !isOverlappingAny(topLeft.x, topLeft.y, w, h, rot, ignoreId)) {
    return wantedCenter
  }

  // Spiral search around wanted center
  const maxRadius = 1000
  const step = Math.max(8, Math.min(w, h) / 2)
  for (let r = step; r <= maxRadius; r += step) {
    const steps = Math.max(12, Math.floor((2 * Math.PI * r) / step))
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const cx = wantedCenter.x + Math.cos(angle) * r
      const cy = wantedCenter.y + Math.sin(angle) * r
      const tx = cx - w / 2
      const ty = cy - h / 2
      if (!isRectFullyInsideRoom(tx, ty, w, h, rot)) continue
      if (isOverlappingAny(tx, ty, w, h, rot, ignoreId)) continue
      return { x: cx, y: cy }
    }
  }

  // Fallback: place at snapped center inside room (may overlap)
  const snapped = snapRectInsideRoom(topLeft.x, topLeft.y, w, h, rot)
  return { x: snapped.x + w / 2, y: snapped.y + h / 2 }
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
    // ensure we don't place on top of existing items
    const wantedCenter = { x: pos.x + item.w / 2, y: pos.y + item.h / 2 }
    const center = findClosestNonOverlappingCenter(wantedCenter, item.w, item.h, item.rotation || 0, id)
    const finalPos = { x: center.x - item.w / 2, y: center.y - item.h / 2 }
    await storage.updatePos(id, finalPos.x, finalPos.y)
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
  // Find nearest non-overlapping center (ignore this item)
  const wantedCenter = { x: pos.x + item.w / 2, y: pos.y + item.h / 2 }
  const center = findClosestNonOverlappingCenter(wantedCenter, item.w, item.h, item.rotation || 0, id)
  const finalPos = { x: center.x - item.w / 2, y: center.y - item.h / 2 }
  node.x(finalPos.x + item.w / 2)
  node.y(finalPos.y + item.h / 2)
  storage.updatePos(id, finalPos.x, finalPos.y)
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
  let pos = snapRectInsideRoom(x, y, side, side, rot)
  // ensure no overlap after transform (ignore this item)
  const wantedCenter = { x: pos.x + side / 2, y: pos.y + side / 2 }
  const center = findClosestNonOverlappingCenter(wantedCenter, side, side, rot, id)
  pos = { x: center.x - side / 2, y: center.y - side / 2 }
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

        <!-- Render windows saved on the room (show openings and caps) -->
        <template v-for="(win, idx) in windowsWithPoints" :key="'win' + win.index">
          <v-line :config="{
              points: [win.p1.x, win.p1.y, win.p2.x, win.p2.y],
              stroke: 'rgba(16,185,129,0.06)',
              strokeWidth: 8,
              lineCap: 'butt',
              listening: false
            }" />
          <v-line :config="{
              points: capPointsAt(win.p1, getWindowPerp(win.p1, win.p2).nx, getWindowPerp(win.p1, win.p2).ny, 14),
              stroke: '#e5e7eb', strokeWidth: 2, listening: false
            }" />
          <v-line :config="{
              points: capPointsAt(win.p2, getWindowPerp(win.p1, win.p2).nx, getWindowPerp(win.p1, win.p2).ny, 14),
              stroke: '#e5e7eb', strokeWidth: 2, listening: false
            }" />
        </template>

        <!-- Doors (L-junction at p1, curved line from p2 to L tip) -->
        <template v-for="(door, idx) in doorsWithPoints" :key="'door' + door.index">
          <!-- L-junction: vertical line along the edge from p1 -->
          <v-line
            :config="{
              points: [door.lJuncVertStart.x, door.lJuncVertStart.y, door.lJuncVertEnd.x, door.lJuncVertEnd.y],
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <!-- L-junction: perpendicular cap going outward from p1 -->
          <v-line
            :config="{
              points: [door.lJuncVertStart.x, door.lJuncVertStart.y, door.lJuncCapEnd.x, door.lJuncCapEnd.y],
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <!-- Curved line from p2 to the tip of L-junction (using bezier curve points, white color) -->
          <v-line
            :config="{
              points: door.curvePoints,
              stroke: '#fff',
              strokeWidth: 2.5,
              listening: false,
              lineCap: 'round'
            }"
          />
        </template>

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
                // Allow dragging freely anywhere inside the room (do not block over other items).
                if (isRectFullyInsideRoom(tx, ty, item.w, item.h, item.rotation)) {
                  return wantedCenter
                }
                // If outside, find closest center that is fully inside (but may overlap); collisions resolved on drop
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
                x: -Math.min(item.w, item.h) * 0.7 / 2,
                y: -Math.min(item.w, item.h) * 0.7 / 2,
                width: Math.min(item.w, item.h) * 0.7,
                height: Math.min(item.w, item.h) * 0.7,
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
