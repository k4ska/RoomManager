import { defineStore } from 'pinia'

export type ShapeType = 'rectangle' | 'square' | 'triangle' | 'polygon'

const runtime = (useRuntimeConfig?.() as any)
  const publicCfg = runtime.public
  const publicApiBase = publicCfg.apiBase

interface Point { x: number; y: number }

export const useRoomShapeStore = defineStore('roomShape', () => {
  const stage = reactive({ width: 800, height: 600 })

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
  // Store windows as edge-relative fractions (t1,t2 in [0,1]) so they follow wall geometry
  const windows = ref<Array<{ edgeIndex: number; t1: number; t2: number }>>([])
  const windowSelection = ref<{ edgeIndex: number; t: number } | null>(null)

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

    // Arvutab kauguse punktist sirglõiguni
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

  return {
    stage,
    shape,
    points,
    addPointMode,
    showShapeModal,
    addWindowMode,
    windows,
    windowSelection,
    updatePoint,
    resetShape,
    setShape,
    toggleAddPointMode,
    openShapeModal,
    closeShapeModal,
    insertPointOnNearestEdge,
    snapEnabled,
    toggleSnap,
    toggleAddWindowMode,
    selectWindowPoint,
    deleteWindow,
    clearWindows,
    // Laeb salvestatud toakuju backendist (kui on)
    async loadFromServer() {
      try {
        const res = await fetch(`${publicApiBase}/api/room-shape`, { credentials: 'include' })
        const data = await res.json()
        if (data?.ok && Array.isArray(data.shape)) {
          points.value = normalizeToStage(data.shape)
        }
        // Load windows if backend returned them (stored as edge fractions)
        if (data?.ok && Array.isArray(data.windows)) {
          try {
            // validate and sanitize
            const parsed = data.windows.map((w: any) => {
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
      } catch {}
    },
    // Salvestab praeguse toakuju backendi
    async saveToServer() {
      try {
        normalizeCurrent()
        const payload: any = { points: points.value }
        // include windows as edge-relative fractions so backend can persist them
        if (windows.value && windows.value.length) {
          payload.windows = windows.value.map(w => ({ edgeIndex: w.edgeIndex, t1: w.t1, t2: w.t2 }))
        }
        await fetch(`${publicApiBase}/api/room-shape`, {
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
