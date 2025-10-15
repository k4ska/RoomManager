import { defineStore } from 'pinia'

export type ShapeType = 'rectangle' | 'square' | 'triangle' | 'polygon'

interface Point { x: number; y: number }

export const useRoomShapeStore = defineStore('roomShape', () => {
  const stage = reactive({ width: 800, height: 600 })

  const shape = ref<ShapeType>('rectangle')
  const points = ref<Point[]>([
    { x: 100, y: 100 },
    { x: 700, y: 100 },
    { x: 700, y: 500 },
    { x: 100, y: 500 }
  ])

  const addPointMode = ref(false)
  const showShapeModal = ref(false)

  // Clamps a value between min and max
  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v))
  }

  // Updates a point position while keeping it within stage bounds
  function updatePoint(index: number, x: number, y: number) {
    points.value[index] = {
      x: clamp(x, 0, stage.width),
      y: clamp(y, 0, stage.height)
    }
  }

  // Resets the room shape to default rectangle
  function resetShape() {
    setShape('rectangle')
  }

  // Sets the room shape and updates corner points
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
      // rectangle or polygon default to rectangle footprint
      points.value = [
        { x: w * 0.15, y: h * 0.2 },
        { x: w * 0.85, y: h * 0.2 },
        { x: w * 0.85, y: h * 0.8 },
        { x: w * 0.15, y: h * 0.8 }
      ]
    }
  }

  // Toggles the add-point mode
  function toggleAddPointMode() {
    addPointMode.value = !addPointMode.value
  }

  // Opens the shape selection modal
  function openShapeModal() { showShapeModal.value = true }
  // Closes the shape selection modal
  function closeShapeModal() { showShapeModal.value = false }

  // Inserts a point to the nearest edge to the given coordinates
  function insertPointOnNearestEdge(x: number, y: number) {
    if (points.value.length < 2) return
    const arr = points.value
    let bestDist = Number.POSITIVE_INFINITY
    let insertIndex = 0

    // Calculates distance from a point to a line segment
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

  return {
    stage,
    shape,
    points,
    addPointMode,
    showShapeModal,
    updatePoint,
    resetShape,
    setShape,
    toggleAddPointMode,
    openShapeModal,
    closeShapeModal,
    insertPointOnNearestEdge
  }
})
