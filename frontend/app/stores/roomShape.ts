import { defineStore } from 'pinia'

export type ShapeType = 'rectangle' | 'square' | 'triangle' | 'polygon'

function apiBase() {
  try {
    const runtime = useRuntimeConfig()
    return (runtime as any)?.public?.apiBase || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
  } catch {
    return process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
  }
}

function shapeUrl(roomId?: number | null) {
  return roomId ? `${apiBase()}/api/rooms/${roomId}/shape` : `${apiBase()}/api/room-shape`
}

function activeRoomId(): number | null {
  try {
    const storage = useStorageStore()
    return storage.currentRoomId
  } catch {
    return null
  }
}

interface Point { x: number; y: number }

export const useRoomShapeStore = defineStore('roomShape', () => {
  const stage = reactive({ width: 1250, height: 720 })

  const snapEnabled = ref<boolean>(false) 

  const shape = ref<ShapeType>('rectangle')
  const points = ref<Point[]>([
    { x: 100, y: 100 },
    { x: 700, y: 100 },
    { x: 700, y: 500 },
    { x: 100, y: 500 }
  ])
  const VIEW_MARGIN = 60 // jätab ruumi serva ja toa vahel

  const addPointMode = ref(false)
  const showShapeModal = ref(false)
  const addWindowMode = ref(false)
  const addDoorMode = ref(false)
  const doorDirection = ref<'inside' | 'outside'>('inside')
  const showMetrics = ref(false)
  // Metrics scale: 40 pixels = 1 meter (grid square = 1m by default)
  const metricsScale = ref(40) // pixels per meter
  const gridSizeMeters = ref(1) // meters per grid cell
  // Store windows as edge-relative fractions (t1,t2 in [0,1]) so they follow wall geometry
  const windows = ref<Array<{ edgeIndex: number; t1: number; t2: number }>>([])  
  const windowSelection = ref<{ edgeIndex: number; t: number } | null>(null)
  // Store doors as edge-relative fractions (t1,t2 in [0,1]) so they follow wall geometry
  const doors = ref<Array<{ edgeIndex: number; t1: number; t2: number; direction?: 'inside' | 'outside' }>>([])    
  const doorSelection = ref<{ edgeIndex: number; t: number } | null>(null)
  // Piirab väärtuse vahemikku [min, max]
  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v))
  }

  // Skaleerib antud punktid lava mõõtu jättes serva ääre alla
  function normalizeToStage(src: Point[]): Point[] {
    if (!src?.length) return src
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const p of src) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return src
    const width = Math.max(1, maxX - minX)
    const height = Math.max(1, maxY - minY)
    const availW = Math.max(10, stage.width - VIEW_MARGIN * 2)
    const availH = Math.max(10, stage.height - VIEW_MARGIN * 2)
    const scale = Math.min(availW / width, availH / height)
    const scaledW = width * scale
    const scaledH = height * scale
    const offsetX = (stage.width - scaledW) / 2
    const offsetY = (stage.height - scaledH) / 2
    return src.map(p => ({
      x: offsetX + (p.x - minX) * scale,
      y: offsetY + (p.y - minY) * scale
    }))
  }

  // Rakendab normaliseerimist praegustele punktidele
  function normalizeCurrent() {
    points.value = normalizeToStage(points.value)
  }

  // Uuendab punkti asukohta, hoides seda lava piirides
  function updatePoint(index: number, x: number, y: number) {
    const nx = clamp(x, 0, stage.width)
    const ny = clamp(y, 0, stage.height)
    // Use splice so Vue detects the array change and updates bindings
    points.value.splice(index, 1, { x: nx, y: ny })
  }

  // Lähtestab toakuju vaikimisi ristkülikuks
  function resetShape() {
    setShape('rectangle')
    clearDoors()
    clearWindows()
  }

  // Seab toakuju ning uuendab nurkade koordinaadid
  function setShape(type: ShapeType) {
    shape.value = type
    const w = stage.width
    const h = stage.height
    if (type === 'square') {
      const size = Math.min(w, h) * 0.6
      const cx = w / 2
      const cy = h / 2
      const half = size / 2
      points.value = [
        { x: cx - half, y: cy - half },
        { x: cx + half, y: cy - half },
        { x: cx + half, y: cy + half },
        { x: cx - half, y: cy + half }
      ]
    } else if (type === 'triangle') {
      points.value = [
        { x: w * 0.5, y: h * 0.2 },
        { x: w * 0.75, y: h * 0.75 },
        { x: w * 0.25, y: h * 0.75 }
      ]
    } else {
      // Ristkülik või hulknurk vaikimisi ristküliku kujuga
      points.value = [
        { x: w * 0.15, y: h * 0.2 },
        { x: w * 0.85, y: h * 0.2 },
        { x: w * 0.85, y: h * 0.8 },
        { x: w * 0.15, y: h * 0.8 }
      ]
    }
    normalizeCurrent()
  }

  // Lülitab punktide lisamise režiimi
  function toggleAddPointMode() {
    addPointMode.value = !addPointMode.value
  }

  //Lülitab grid snap funktsiooni
  function toggleSnap() { snapEnabled.value = !snapEnabled.value }

  // Avab kuju valiku akna
  function openShapeModal() { showShapeModal.value = true }
  // Sulgeb kuju valiku akna
  function closeShapeModal() { showShapeModal.value = false }

  // Lisab punkti lähimale servale antud koordinaatide järgi
  function insertPointOnNearestEdge(x: number, y: number) {
    if (points.value.length < 2) return
    const arr = points.value
    let bestDist = Number.POSITIVE_INFINITY
    let insertIndex = 0

    function distPointToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
      const abx = bx - ax
      const aby = by - ay
      const apx = px - ax
      const apy = py - ay
      const ab2 = abx * abx + aby * aby
      const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
      const qx = ax + t * abx
      const qy = ay + t * aby
      const dx = px - qx
      const dy = py - qy
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Save old points for remapping
    const oldPoints = arr.map(p => ({ x: p.x, y: p.y }))
    const oldWindows = windows.value.map(w => ({ ...w }))
    const oldDoors = doors.value.map(d => ({ ...d }))

    // Find where to insert new point
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]
      const b = arr[(i + 1) % arr.length]
      const d = distPointToSeg(x, y, a.x, a.y, b.x, b.y)
      if (d < bestDist) {
        bestDist = d
        insertIndex = i + 1
      }
    }
    points.value.splice(insertIndex, 0, { x: clamp(x, 0, stage.width), y: clamp(y, 0, stage.height) })

    // Helper: get absolute position of window/door on old wall
    function getFeaturePos(feature: { edgeIndex: number; t1?: number; t2?: number; t?: number }) {
      const a = oldPoints[feature.edgeIndex]
      const b = oldPoints[(feature.edgeIndex + 1) % oldPoints.length]
      // For windows: t1 and t2, for doors: t1/t2 or t
      if (feature.t1 !== undefined && feature.t2 !== undefined) {
        // Use midpoint for remapping
        const tx = (feature.t1 + feature.t2) / 2
        return { x: a.x + (b.x - a.x) * tx, y: a.y + (b.y - a.y) * tx }
      } else {
        const t = feature.t ?? 0
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      }
    }

    // Remap windows
    windows.value = oldWindows.map(w => {
      const pos = getFeaturePos(w)
      // Find closest edge on new wall
      let bestEdge = 0, bestDist = Number.POSITIVE_INFINITY, bestT = 0
      for (let i = 0; i < points.value.length; i++) {
        const a = points.value[i]
        const b = points.value[(i + 1) % points.value.length]
        // Project pos onto edge
        const abx = b.x - a.x, aby = b.y - a.y
        const apx = pos.x - a.x, apy = pos.y - a.y
        const ab2 = abx * abx + aby * aby || 1
        const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
        const qx = a.x + abx * t, qy = a.y + aby * t
        const dist = Math.sqrt((pos.x - qx) ** 2 + (pos.y - qy) ** 2)
        if (dist < bestDist) {
          bestDist = dist
          bestEdge = i
          bestT = t
        }
      }
      // For windows, keep width by projecting both endpoints
      const a = oldPoints[w.edgeIndex], b = oldPoints[(w.edgeIndex + 1) % oldPoints.length]
      const p1 = { x: a.x + (b.x - a.x) * w.t1, y: a.y + (b.y - a.y) * w.t1 }
      const p2 = { x: a.x + (b.x - a.x) * w.t2, y: a.y + (b.y - a.y) * w.t2 }
      // Project both endpoints to new edge
      const newA = points.value[bestEdge], newB = points.value[(bestEdge + 1) % points.value.length]
      function projectToEdge(pt: { x: number; y: number }, a: Point, b: Point) {
        const abx = b.x - a.x, aby = b.y - a.y
        const apx = pt.x - a.x, apy = pt.y - a.y
        const ab2 = abx * abx + aby * aby || 1
        return Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
      }
      const t1 = projectToEdge(p1, newA, newB)
      const t2 = projectToEdge(p2, newA, newB)
      return { edgeIndex: bestEdge, t1: Math.min(t1, t2), t2: Math.max(t1, t2) }
    })

    // Remap doors
    doors.value = oldDoors.map(d => {
      const pos = getFeaturePos(d)
      let bestEdge = 0, bestDist = Number.POSITIVE_INFINITY, bestT = 0
      for (let i = 0; i < points.value.length; i++) {
        const a = points.value[i]
        const b = points.value[(i + 1) % points.value.length]
        const abx = b.x - a.x, aby = b.y - a.y
        const apx = pos.x - a.x, apy = pos.y - a.y
        const ab2 = abx * abx + aby * aby || 1
        const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
        const qx = a.x + abx * t, qy = a.y + aby * t
        const dist = Math.sqrt((pos.x - qx) ** 2 + (pos.y - qy) ** 2)
        if (dist < bestDist) {
          bestDist = dist
          bestEdge = i
          bestT = t
        }
      }
      // For doors, project endpoints if t1/t2 exist
      if (d.t1 !== undefined && d.t2 !== undefined) {
        const a = oldPoints[d.edgeIndex], b = oldPoints[(d.edgeIndex + 1) % oldPoints.length]
        const p1 = { x: a.x + (b.x - a.x) * d.t1, y: a.y + (b.y - a.y) * d.t1 }
        const p2 = { x: a.x + (b.x - a.x) * d.t2, y: a.y + (b.y - a.y) * d.t2 }
        const newA = points.value[bestEdge], newB = points.value[(bestEdge + 1) % points.value.length]
        function projectToEdge(pt: { x: number; y: number }, a: Point, b: Point) {
          const abx = b.x - a.x, aby = b.y - a.y
          const apx = pt.x - a.x, apy = pt.y - a.y
          const ab2 = abx * abx + aby * aby || 1
          return Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
        }
        const t1 = projectToEdge(p1, newA, newB)
        const t2 = projectToEdge(p2, newA, newB)
        return { edgeIndex: bestEdge, t1: Math.min(t1, t2), t2: Math.max(t1, t2), direction: d.direction }
      } else {
        return { edgeIndex: bestEdge, t: bestT }
      }
    })
  }

  // Window management
  function toggleAddWindowMode() {
    addWindowMode.value = !addWindowMode.value
    if (!addWindowMode.value) {
      windowSelection.value = null
    }
  }

  function selectWindowPoint(edgeIndex: number, point: Point) {
    // project point to t on edge [0..1]
    const a = points.value[edgeIndex]
    const b = points.value[(edgeIndex + 1) % points.value.length]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = point.x - a.x
    const apy = point.y - a.y
    const ab2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))

    if (!windowSelection.value) {
      // First point selected (store edge and t)
      windowSelection.value = { edgeIndex, t }
      return
    }

    if (windowSelection.value.edgeIndex === edgeIndex) {
      // Second point on same edge - create window using sorted t values
      const t1 = windowSelection.value.t
      const t2 = t
      const low = Math.min(t1, t2)
      const high = Math.max(t1, t2)
      windows.value.push({ edgeIndex, t1: low, t2: high })
      windowSelection.value = null
      return
    }

    // Different edge - start selection on new edge
    windowSelection.value = { edgeIndex, t }
  }

  function deleteWindow(index: number) {
    windows.value.splice(index, 1)
  }

  function clearWindows() {
    windows.value = []
  }

  // Door management
  function toggleAddDoorMode() {
    addDoorMode.value = !addDoorMode.value
    if (!addDoorMode.value) {
      doorSelection.value = null
    }
  }

  function selectDoorPoint(edgeIndex: number, point: Point) {
    // project point to t on edge [0..1]
    const a = points.value[edgeIndex]
    const b = points.value[(edgeIndex + 1) % points.value.length]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const apx = point.x - a.x
    const apy = point.y - a.y
    const ab2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))

    if (!doorSelection.value) {
      // First point selected (store edge and t)
      doorSelection.value = { edgeIndex, t }
      return
    }

    if (doorSelection.value.edgeIndex === edgeIndex) {
      // Second point on same edge - create door using sorted t values
      const t1 = doorSelection.value.t
      const t2 = t
      const low = Math.min(t1, t2)
      const high = Math.max(t1, t2)
      doors.value.push({ edgeIndex, t1: low, t2: high, direction: doorDirection.value })
      doorSelection.value = null
      return
    }

    // Different edge - start selection on new edge
    doorSelection.value = { edgeIndex, t }
  }

  function deleteDoor(index: number) {
    doors.value.splice(index, 1)
  }

  function clearDoors() {
    doors.value = []
  }

  function deletePoint(index: number) {
    if (points.value.length <= 3) return // keep polygon valid
    points.value.splice(index, 1)
  }

  // Metrics helpers
  function toggleShowMetrics() {
    showMetrics.value = !showMetrics.value
  }

  function getWallLengthMeters(edgeIndex: number): number {
    const a = points.value[edgeIndex]
    const b = points.value[(edgeIndex + 1) % points.value.length]
    if (!a || !b) return 0
    const pixels = Math.hypot(b.x - a.x, b.y - a.y)
    return pixels / metricsScale.value
  }

  function setMetricsScale(pixelsPerMeter: number) {
    // enforce integer pixels-per-meter and a minimum of 1
    const intVal = Math.max(1, Math.floor(pixelsPerMeter || 0))
    metricsScale.value = intVal
  }

  function setGridSizeMeters(metersPerCell: number) {
    const clamped = Math.min(10, Math.max(0.1, metersPerCell || 1))
    gridSizeMeters.value = Number(clamped.toFixed(2))
  }

  function setDoorDirection(direction: 'inside' | 'outside') {  // ← LISA SEE
    doorDirection.value = direction
  }

  return {
    stage,
    shape,
    points,
    addPointMode,
    showShapeModal,
    addWindowMode,
    addDoorMode,
    showMetrics,
    metricsScale,
    windows,
    windowSelection,
    doors,
    doorSelection,
    updatePoint,
    resetShape,
    setShape,
    toggleAddPointMode,
    openShapeModal,
    closeShapeModal,
    insertPointOnNearestEdge,
    snapEnabled,
    toggleSnap,
    toggleShowMetrics,
    getWallLengthMeters,
    setMetricsScale,
    gridSizeMeters,
    setGridSizeMeters,
    toggleAddWindowMode,
    selectWindowPoint,
    deleteWindow,
    clearWindows,
    toggleAddDoorMode,
    selectDoorPoint,
    deleteDoor,
    clearDoors,
    deletePoint,
    doorDirection,
    setDoorDirection,
    // Laeb salvestatud toakuju backendist (kui on)
    async loadFromServer(roomId?: number | null) {
      try {
        const targetRoomId = roomId ?? activeRoomId()
        const res = await fetch(shapeUrl(targetRoomId), { credentials: 'include' })
        const data = await res.json()
        if (data?.ok && Array.isArray(data.shape)) {
          points.value = normalizeToStage(data.shape)
        } else if (data?.ok && data.shape && Array.isArray((data.shape as any).points)) {
          points.value = normalizeToStage((data.shape as any).points)
        } else {
          setShape('rectangle')
          windows.value = []
          doors.value = []
          doorDirection.value = 'inside'
        }
        
        // Load windows from new nested shape or top-level for backward compatibility
        const rawWindows = Array.isArray((data.shape as any)?.windows) ? (data.shape as any).windows : (Array.isArray(data.windows) ? data.windows : null)
        if (rawWindows) {
          try {
            const parsed = rawWindows.map((w: any) => {
              const edgeIndex = Number.isFinite(w.edgeIndex) ? Math.max(0, Math.floor(w.edgeIndex)) : 0
              const t1 = typeof w.t1 === 'number' ? Math.max(0, Math.min(1, w.t1)) : (typeof w.t === 'number' ? Math.max(0, Math.min(1, w.t)) : 0)
              const t2 = typeof w.t2 === 'number' ? Math.max(0, Math.min(1, w.t2)) : t1
              return { edgeIndex, t1, t2 }
            })
            windows.value = parsed
          } catch (e) {
            // ignore invalid windows
          }
        }

        // Load doors from shape
        const rawDoors = Array.isArray((data.shape as any)?.doors) ? (data.shape as any).doors : (Array.isArray(data.doors) ? data.doors : null)
        if (rawDoors) {
          try {
            const parsed = rawDoors.map((d: any) => {
              const edgeIndex = Number.isFinite(d.edgeIndex) ? Math.max(0, Math.floor(d.edgeIndex)) : 0
              const t1 = typeof d.t1 === 'number' ? Math.max(0, Math.min(1, d.t1)) : (typeof d.t === 'number' ? Math.max(0, Math.min(1, d.t)) : 0)
              const t2 = typeof d.t2 === 'number' ? Math.max(0, Math.min(1, d.t2)) : t1
              return { edgeIndex, t1, t2, direction: d.direction === 'outside' ? 'outside' : 'inside' }
            })
            doors.value = parsed
            doorDirection.value = data.doorDirection === 'outside' ? 'outside' : 'inside'
          } catch (e) {
            // ignore invalid doors
          }
        }

        // Load grid size and metrics scale if provided
        const ms = (data.shape as any)?.metricsScale ?? data.metricsScale
        if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) {
          setMetricsScale(ms)
        }
        const gs = (data.shape as any)?.gridSizeMeters ?? data.gridSizeMeters
        if (typeof gs === 'number' && Number.isFinite(gs) && gs > 0) {
          setGridSizeMeters(gs)
        }
      } catch {}
    },
    // Salvestab praeguse toakuju backendi
    async saveToServer(roomId?: number | null) {
      try {
        normalizeCurrent()
        const payload: any = { points: points.value }
        // include windows as edge-relative fractions so backend can persist them
        if (windows.value && windows.value.length) {
          payload.windows = windows.value.map(w => ({ edgeIndex: w.edgeIndex, t1: w.t1, t2: w.t2 }))
        }
        // include doors as edge-relative fractions so backend can persist them
        if (doors.value && doors.value.length) {
          payload.doors = doors.value.map(d => ({ 
            edgeIndex: d.edgeIndex, 
            t1: d.t1, 
            t2: d.t2,
            direction: d.direction || doorDirection.value
          }))
        }
        payload.doorDirection = doorDirection.value
        payload.metricsScale = metricsScale.value
        payload.gridSizeMeters = gridSizeMeters.value
        const targetRoomId = roomId ?? activeRoomId()
        await fetch(shapeUrl(targetRoomId), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch {}
    },
    _scheduleSave: () => {}
  }
  // Automaatne salvestamine on keelatud; salvestatakse ainult saveToServer() kutsel
})
