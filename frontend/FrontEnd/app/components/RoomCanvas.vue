<script setup lang="ts">
import { useRoomShapeStore } from '~/stores/roomShape'
const store = useRoomShapeStore()

function doLinesIntersect(a1: {x:number,y:number}, a2: {x:number,y:number}, b1: {x:number,y:number}, b2: {x:number,y:number}) {
  const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x)
  if (det === 0) return false

  const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det
  const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det

  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1)
}

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

      if (doLinesIntersect(a1, a2, b1, b2)) {
        return false
      }
    }
  }
  return true
}

function handleLayerClick(e: any) {
  if (!store.addPointMode) return
  const stage = e.target?.getStage?.()
  const pos = stage?.getPointerPosition?.()
  if (!pos) return
  store.insertPointOnNearestEdge(pos.x, pos.y)
}
</script>

<template>
  <div class="canvas-wrap">
    <v-stage :config="{ width: store.stage.width, height: store.stage.height }">
      <v-layer @click="handleLayerClick">
        <v-rect :config="{ x: 0, y: 0, width: store.stage.width, height: store.stage.height, fill: '#0b1222' }" />
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
          :config="{ x: p.x, y: p.y, radius: 7, fill: '#10b981', stroke: '#052e24', strokeWidth: 1.5, draggable: true }"
          @dragmove="e => {
            const newX = e.target.x()
            const newY = e.target.y()
            if (canMovePoint(i, newX, newY)) {
              store.updatePoint(i, newX, newY)
            } else {
              e.target.position({ x: p.x, y: p.y })
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

