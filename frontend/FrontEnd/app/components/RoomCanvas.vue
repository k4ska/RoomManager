<script setup lang="ts">
import { useRoomShapeStore } from '~/stores/roomShape'
const store = useRoomShapeStore()

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
          @dragmove="e => store.updatePoint(i, e.target.x(), e.target.y())"
        />
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.canvas-wrap { display: flex; justify-content: center; }
</style>
