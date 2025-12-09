<script setup lang="ts">
import { useRoomShapeStore } from '~/stores/roomShape'
import { computed, ref } from 'vue'
import UusConfirmPopup from '~/components/uusConfirmPopup.vue'
const store = useRoomShapeStore()
const winConfirmRef = ref<any>(null)

async function onDeleteWindow(index: number) {
  try {
    const ok = await winConfirmRef.value?.open({ title: 'Kustuta aken?', message: 'Kas oled kindel, et soovid akna kustutada?' })
    if (ok) store.deleteWindow(index)
  } catch (e) {
    // ignore
  }
}

function snapToGrid(x: number, y: number) {
  const gridSize = 40
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize
  }
}

// Checks if two line segments intersect
function linesIntersect(a1: {x:number,y:number}, a2: {x:number,y:number}, b1: {x:number,y:number}, b2: {x:number,y:number}) {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x)
  if (det === 0) return false

  const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det
  const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det

  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)
}

// Validates if moving a point keeps polygon non-self-intersecting
function canMovePoint(index: number, x: number, y: number) {
  const pts = [...store.points]
  pts[index] = { x, y }

  for (let i = 0; i < pts.length; i++) {
    const a1 = pts[i]
    const a2 = pts[(i + 1) % pts.length]
    if (!a1 || !a2) continue

    for (let j = 0; j < pts.length; j++) {
      if (j === i || j === (i + 1) % pts.length) continue

      const b1 = pts[j]
      const b2 = pts[(j + 1) % pts.length]
      if (!b1 || !b2) continue

      if (linesIntersect(a1, a2, b1, b2)) {
        return false
      }
    }
  }
  return true
}

// Handles click to insert a point on the nearest edge or select window points
function handleLayerClick(e: any) {
  const stage = e.target?.getStage?.()
  const pos = stage?.getPointerPosition?.()
  if (!pos) return
  let x = pos.x
  let y = pos.y
  if (store.snapEnabled) {
    const s = snapToGrid(x, y)
    x = s.x; y = s.y
  }

  // Handle window point selection
  if (store.addWindowMode) {
    selectWindowPoint(x, y)
    return
  }

  // Handle adding point to edge
  if (store.addPointMode) {
    store.insertPointOnNearestEdge(x, y)
  }
}

// Find nearest point on edge for window selection
function selectWindowPoint(x: number, y: number) {
  const pts = store.points
  if (pts.length < 2) return

  let bestDist = Number.POSITIVE_INFINITY
  let bestEdge = 0
  let bestPoint = { x, y }

  // Find nearest point on any edge
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]

    // Project point onto line segment
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = x - a.x
    const apy = y - a.y
    const ab2 = abx * abx + aby * aby
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
    const qx = a.x + t * abx
    const qy = a.y + t * aby

    const dist = Math.hypot(x - qx, y - qy)
    if (dist < bestDist) {
      bestDist = dist
      bestEdge = i
      bestPoint = { x: qx, y: qy }
    }
  }

  store.selectWindowPoint(bestEdge, bestPoint)
}

// Helpers for rendering windows: compute perpendicular and cap points
function getWindowPerp(p1: {x:number,y:number}, p2: {x:number,y:number}) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  // perpendicular unit vector (points inward/outward depending on orientation)
  const nx = -uy
  const ny = ux
  return { dx, dy, len, ux, uy, nx, ny }
}

function capPointsAt(p: {x:number,y:number}, nx: number, ny: number, capLen: number) {
  const half = capLen / 2
  return [p.x - nx * half, p.y - ny * half, p.x + nx * half, p.y + ny * half]
}

// Map windows (edge-relative) to actual coordinates so they follow wall geometry
const windowsWithPoints = computed(() => {
  try {
    return (store.windows || []).map((w: any, idx: number) => {
      const a = store.points[w.edgeIndex]
      const b = store.points[(w.edgeIndex + 1) % store.points.length]
      if (!a || !b) return { ...w, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, index: idx }
      const p1 = { x: a.x + (b.x - a.x) * (w.t1 ?? w.t ?? 0), y: a.y + (b.y - a.y) * (w.t1 ?? w.t ?? 0) }
      const p2 = { x: a.x + (b.x - a.x) * (w.t2 ?? w.t ?? 0), y: a.y + (b.y - a.y) * (w.t2 ?? w.t ?? 0) }
      return { ...w, p1, p2, index: idx }
    })
  } catch (e) {
    return []
  }
})

const windowSelectionPoint = computed(() => {
  const sel = store.windowSelection
  if (!sel) return null
  const a = store.points[sel.edgeIndex]
  const b = store.points[(sel.edgeIndex + 1) % store.points.length]
  if (!a || !b) return null
  const x = a.x + (b.x - a.x) * sel.t
  const y = a.y + (b.y - a.y) * sel.t
  return { x, y }
})
</script>

<template>
  <div class="canvas-wrap">
    <v-stage :config="{
      width: store.stage.width,
      height: store.stage.height
    }">

    
      <v-layer @click="handleLayerClick">
        <v-rect :config="{
          x: 0,
          y: 0,
          width: store.stage.width,
          height: store.stage.height,
          fill: '#0b1222'
        }" />

        <v-line
          v-for="i in Math.floor(store.stage.width / 40) + 1"
          :key="'v' + i"
          :config="{
            points: [(i - 1) * 40, 0, (i - 1) * 40, store.stage.height],
            stroke: 'rgba(255,255,255,0.06)',
            strokeWidth: 1
          }"
        />
        <v-line
          v-for="i in Math.floor(store.stage.height / 40) + 1"
          :key="'h' + i"
          :config="{
            points: [0, (i - 1) * 40, store.stage.width, (i - 1) * 40],
            stroke: 'rgba(255,255,255,0.06)',
            strokeWidth: 1
          }"
        />

        <v-line
          :points="store.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.08)'"
        />
        <v-circle
          v-for="(p, i) in store.points"
          :key="i"
          :config="{
            x: p.x,
            y: p.y,
            radius: 7,
            fill: '#10b981',
            stroke: '#052e24',
            strokeWidth: 1.5,
            draggable: true
          }"
          @dragmove="e => {
            const newX = e.target.x()
            const newY = e.target.y()
            const target = store.snapEnabled ? snapToGrid(newX, newY) : { x: newX, y: newY }
            if (canMovePoint(i, target.x, target.y)) {
              // update store with (possibly snapped) coordinates so polygon follows
              store.updatePoint(i, target.x, target.y)
              // ensure visual handle is at exact coords
              e.target.position({ x: target.x, y: target.y })
            } else {
              // revert visual handle to the stored point
              const cur = store.points[i] || { x: newX, y: newY }
              e.target.position({ x: cur.x, y: cur.y })
            }
          }"
        />

        <!-- Windows rendering -->
        <template v-for="(win, winIdx) in windowsWithPoints" :key="'win' + win.index">
          <!-- Cover the wall stroke to create an opening (draw over with room fill) -->
          <v-line
            :config="{
              points: [win.p1.x, win.p1.y, win.p2.x, win.p2.y],
              stroke: 'rgba(16,185,129,0.08)',
              strokeWidth: 8,
              lineCap: 'butt',
              listening: false
            }"
          />
          <!-- Perpendicular caps at both ends (small T-like stoppers) -->
          <v-line
            :config="{
              points: capPointsAt(win.p1, getWindowPerp(win.p1, win.p2).nx, getWindowPerp(win.p1, win.p2).ny, 14),
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <v-line
            :config="{
              points: capPointsAt(win.p2, getWindowPerp(win.p1, win.p2).nx, getWindowPerp(win.p1, win.p2).ny, 14),
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <!-- Delete window button -->
          <v-circle
            :config="{
              x: (win.p1.x + win.p2.x) / 2,
              y: (win.p1.y + win.p2.y) / 2,
              radius: 6,
              fill: '#ef4444',
              stroke: '#ffffff',
              strokeWidth: 1,
              opacity: 0.9
            }"
            @click="(e:any) => { e.cancelBubble = true; onDeleteWindow(win.index) }"
          />
        </template>

        <!-- Window selection preview -->
        <template v-if="windowSelectionPoint">
          <v-circle
            :config="{
              x: windowSelectionPoint.x,
              y: windowSelectionPoint.y,
              radius: 5,
              fill: '#fbbf24',
              stroke: '#ffffff',
              strokeWidth: 1
            }"
          />
          <v-text
            :config="{
              x: windowSelectionPoint.x + 10,
              y: windowSelectionPoint.y - 10,
              text: 'Select 2nd point',
              fontSize: 12,
              fill: '#fbbf24',
              listening: false
            }"
          />
        </template>
      </v-layer>
    </v-stage>
    <UusConfirmPopup ref="winConfirmRef" />
  </div>
</template>

<style scoped>
.canvas-wrap { 
  display: flex; 
  justify-content: center; 
}
</style>

