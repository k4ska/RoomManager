<script setup lang="ts">
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'
import { computed, ref } from 'vue'
import UusConfirmPopup from '~/components/uusConfirmPopup.vue'
const store = useRoomShapeStore()
const storageStore = useStorageStore()
const winConfirmRef = ref<any>(null)
const doorConfirmRef = ref<any>(null)

// metrics panel removed: no panel position or dragging state

// (metrics panel removed) room area calculation and panel UI moved out

async function onDeleteWindow(index: number) {
  try {
    const ok = await winConfirmRef.value?.open({ title: 'Kustuta aken?', message: 'Kas oled kindel, et soovid akna kustutada?' })
    if (ok) store.deleteWindow(index)
  } catch (e) {
    // ignore
  }
}

async function onDeleteDoor(index: number) {
  try {
    const ok = await doorConfirmRef.value?.open({ title: 'Kustuta uks?', message: 'Kas oled kindel, et soovid ukse kustutada?' })
    if (ok) store.deleteDoor(index)
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

// Handles click to insert a point on the nearest edge or select window/door points
// Resize a wall by changing its length (keeps first point fixed, moves second point)
// panel-related functions removed

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

  // Handle door point selection
  if (store.addDoorMode) {
    selectDoorPoint(x, y)
    return
  }

  // Handle window point selection
  if (store.addWindowMode) {
    selectWindowPoint(x, y)
    return
  }

  // Handle adding point to edge
  if (store.addPointMode) {
    store.insertPointOnNearestEdge(x, y)
    return
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

// Find nearest point on edge for door selection (single point)
function selectDoorPoint(x: number, y: number) {
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

  store.selectDoorPoint(bestEdge, bestPoint)
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

const doorSelectionPoint = computed(() => {
  const sel = store.doorSelection
  if (!sel) return null
  const a = store.points[sel.edgeIndex]
  const b = store.points[(sel.edgeIndex + 1) % store.points.length]
  if (!a || !b) return null
  const x = a.x + (b.x - a.x) * sel.t
  const y = a.y + (b.y - a.y) * sel.t
  return { x, y }
})

// Map doors (edge-relative) to actual coordinates and compute arc path
const doorsWithPoints = computed(() => {
  try {
    return (store.doors || []).map((d: any, idx: number) => {
      const a = store.points[d.edgeIndex]
      const b = store.points[(d.edgeIndex + 1) % store.points.length]
      if (!a || !b) return { ...d, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, index: idx }
      
      // Door opening endpoints on edge (p1 = L-junction start, p2 = curve end)
      const p1 = { x: a.x + (b.x - a.x) * (d.t1 ?? 0), y: a.y + (b.y - a.y) * (d.t1 ?? 0) }
      const p2 = { x: a.x + (b.x - a.x) * (d.t2 ?? 0), y: a.y + (b.y - a.y) * (d.t2 ?? 0) }
      
      // Perpendicular direction (always LEFT of p1->p2 direction)
      const edgePerp = getWindowPerp(p1, p2)
      const capLen = 18

      const isInside = (d.direction || 'inside') === 'inside'
      const nx = isInside ? edgePerp.nx : -edgePerp.nx
      const ny = isInside ? edgePerp.ny : -edgePerp.ny

      const lJuncVertStart = p1
      const lJuncVertEnd = p2
      const lJuncCapEnd = { x: p1.x + nx * capLen, y: p1.y + ny * capLen }

      // PERFECT MIRROR CURVE - use SAME nx/ny for control point (not edgePerp!)
      const curvePoints = []
      const midX = (lJuncCapEnd.x + p2.x) / 2
      const midY = (lJuncCapEnd.y + p2.y) / 2
      let cpOffset = 18
      const vecToMid = { x: midX - lJuncCapEnd.x, y: midY - lJuncCapEnd.y }
      const proj = vecToMid.x * nx + vecToMid.y * ny  // USE nx/ny NOT edgePerp!
      if (proj + cpOffset > capLen) cpOffset = Math.max(0, capLen - proj)
      const cpx = midX + nx * cpOffset  // USE nx/ny NOT edgePerp!
      const cpy = midY + ny * cpOffset  // USE nx/ny NOT edgePerp!

      // Clamp to wall
      const clampToWall = (x: number, y: number) => {
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
        if (t === 1) {
          const clamped = clampToWall(px, py)
          px = clamped.x; py = clamped.y
        }
        curvePoints.push(px, py)
      }
      
      return { 
        ...d, p1, p2, lJuncVertStart, lJuncVertEnd, lJuncCapEnd, curvePoints, index: idx 
      }
    })
  } catch (e) {
    return []
  }
})


// (panel is rendered outside the canvas-wrap; no position state required)

// compute room area (shoelace) in meters^2 using store.metricsScale
const roomAreaM2 = computed(() => {
  const pts = store.points
  if (!pts || pts.length < 3) return 0
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  area = Math.abs(area) / 2
  return area / (store.metricsScale * store.metricsScale)
})

async function persistShape() {
  try {
    const roomId = await storageStore.ensureRoom()
    await store.saveToServer(roomId)
  } catch {}
}

function onDoorDirectionChange(index: number, event: Event) {
  const target = event.target as HTMLSelectElement
  const newDir = target.value as 'inside' | 'outside'
  
  const door = { ...store.doors[index], direction: newDir }
  store.doors.splice(index, 1, door)

  persistShape()
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
  persistShape()
}

// Called when user edits wall length (meters) in panel.
function onWallMetersChange(edgeIndex: number, newLengthMeters: number) {
  if (!newLengthMeters || newLengthMeters <= 0) return
  const px = getWallPixels(edgeIndex)
  if (px <= 0) return
  // required pixels-per-meter so that given meters fit into current pixel length
  const requiredScale = px / newLengthMeters
  if (isFinite(requiredScale) && requiredScale > 0) {
    // Only reduce global scale when necessary (do not increase it).
    if (requiredScale < store.metricsScale) {
      // choose integer px/m (floor) but at least 1
      const newScale = Math.max(1, Math.floor(requiredScale))
      store.setMetricsScale(newScale)
    }
  }
  // now resize using the (possibly updated) store.metricsScale
  resizeWall(edgeIndex, newLengthMeters)
}

</script>

<template>
  <div class="canvas-container">
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

        <!-- Wall polygon -->
        <v-line
          :points="store.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.08)'"
        />
        <!-- Regular points (green vertices) -->
        <v-circle
          v-for="(p, i) in store.points"
          :key="'pt' + i"
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

        <!-- Doors rendering (L-junction at p1, curved line from p2 to L tip) -->
        <template v-for="(door, doorIdx) in doorsWithPoints" :key="'door' + door.index">
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
          <!-- Delete door button -->
          <v-circle
            :config="{
              x: (door.p1.x + door.p2.x) / 2,
              y: (door.p1.y + door.p2.y) / 2,
              radius: 6,
              fill: '#ef4444',
              stroke: '#ffffff',
              strokeWidth: 1,
              opacity: 0.9
            }"
            @click="(e:any) => { e.cancelBubble = true; onDeleteDoor(door.index) }"
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

        <!-- Door selection preview -->
        <template v-if="doorSelectionPoint">
          <v-circle
            :config="{
              x: doorSelectionPoint.x,
              y: doorSelectionPoint.y,
              radius: 5,
              fill: '#fbbf24',
              stroke: '#ffffff',
              strokeWidth: 1
            }"
          />
          <v-text
            :config="{
              x: doorSelectionPoint.x + 10,
              y: doorSelectionPoint.y - 10,
              text: 'Select 2nd point',
              fontSize: 12,
              fill: '#fbbf24',
              listening: false
            }"
          />
        </template>

        <!-- Wall metrics display on canvas grid -->
        <template v-if="store.showMetrics">
          <template v-for="(p, i) in store.points" :key="'wall-metric-' + i">
            <v-text
              :config="(() => {
                const a = store.points[i]
                const b = store.points[(i + 1) % store.points.length]
                if (!a || !b) return { x: 0, y: 0, text: '', fontSize: 0 }
                const midX = (a.x + b.x) / 2
                const midY = (a.y + b.y) / 2
                const lengthM = store.getWallLengthMeters(i)
                return {
                  x: midX - 25,
                  y: midY - 15,
                  text: 'S' + (i + 1) + ': ' + lengthM.toFixed(2) + 'm',
                  fontSize: 12,
                  fill: '#fbbf24',
                  fontStyle: 'bold',
                  listening: false
                }
              })()"
            />
          </template>
        </template>
      </v-layer>
    </v-stage>
    <UusConfirmPopup ref="winConfirmRef" />
    <UusConfirmPopup ref="doorConfirmRef" />
    </div>

    <!-- Simple metrics panel (rendered beside the canvas) -->
    <div v-if="store.showMetrics" class="simple-metrics-panel">
      <div class="simple-panel-header">
        <div>Mõõdud</div>
        <button class="simple-close" @click="store.toggleShowMetrics()">×</button>
      </div>
      <div class="simple-panel-body">
        <div class="row">
          <label>Px per meter:</label>
          <input type="number" :value="store.metricsScale" step="1" min="1" @input="e => {
            const v = parseInt((e.target as any).value, 10)
            if (!isNaN(v)) store.setMetricsScale(v)
          }" />
        </div>
        <div class="row">
          <label>Ruumi pindala (m²):</label>
          <div>{{ roomAreaM2.toFixed(2) }}</div>
        </div>
        <div class="row">
          <label>Uute uste suund:</label>
          <select v-model="store.doorDirection" @change="persistShape()">
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
  </div>
</template>

<style scoped>
.canvas-wrap { 
  display: flex; 
  justify-content: center; 
  position: relative;
}

.canvas-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
}

/* Simple metrics panel styles */
.simple-metrics-panel {
  position: relative;
  width: 260px;
  background: rgba(11,18,34,0.95);
  border: 1px solid #fbbf24;
  color: #e5e7eb;
  z-index: 5000;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.4);
  font-size: 12px;
}
.simple-panel-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:8px 10px;
  border-bottom:1px solid rgba(251,191,36,0.08);
  cursor:default;
  color:#fbbf24;
  font-weight:600;
}
.simple-close{background:none;border:0;color:#fbbf24;font-size:16px;cursor:pointer}
.simple-panel-body{padding:8px}
.simple-panel-body .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.walls-list{max-height:200px;overflow:auto;border-top:1px dashed rgba(255,255,255,0.03);padding-top:8px}
.walls-header{color:#fbbf24;font-weight:700;margin-bottom:6px}
.wall-row{display:flex;gap:6px;align-items:center;padding:4px 0}
.wall-label{width:30px;color:#fbbf24}
.wall-px{width:70px;color:#cbd5e1;font-size:11px}
.wall-meter{flex:1;padding:4px;border-radius:4px;border:1px solid rgba(251,191,36,0.15);background:rgba(51,65,85,0.6);color:#fbbf24;text-align:right}
.doors-list{max-height:120px;overflow:auto;border-top:1px dashed rgba(255,255,255,0.03);padding-top:8px;margin-top:8px}
.doors-header{color:#fbbf24;font-weight:700;margin-bottom:6px}
.door-row{display:flex;gap:6px;align-items:center;padding:4px 0}
.door-label{width:30px;color:#fbbf24}
</style>

