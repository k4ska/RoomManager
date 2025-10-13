<script setup lang="ts">
import { ref } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore, type StorageType } from '~/stores/storageStore'
const room = useRoomShapeStore()
const storage = useStorageStore()
const props = defineProps<{ selectedId?: number | null }>()
const emit = defineEmits<{ (e: 'select', id: number): void }>()

const hoverId = ref<number | null>(null)

function linesFor(it: { contents?: { name: string; quantity: number }[] }) {
  const items = it.contents ?? []
  if (!items.length) return 'Tühi'
  const max = 3
  const shown = items.slice(0, max).map(x => `${x.name} × ${x.quantity}`)
  const extra = items.length - shown.length
  return extra > 0 ? shown.concat([`+${extra} veel`]).join('\n') : shown.join('\n')
}
function fillFor(type: StorageType) {
  switch(type){
    case 'box': return '#38bdf8'
    case 'cabinet': return '#f59e0b'
    case 'shelf': return '#a78bfa'
    case 'table': return '#34d399'
    case 'drawer': return '#f472b6'
    case 'locker': return '#22d3ee'
    case 'workbench': return '#eab308'
  }
}
</script>

<template>
  <div class="canvas-wrap">
    <v-stage :config="{ width: room.stage.width, height: room.stage.height }">
      <v-layer>
        <v-rect :config="{ x: 0, y: 0, width: room.stage.width, height: room.stage.height, fill: '#0b1222' }" />
        <v-line
          :points="room.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.06)'"
        />
        <template v-for="it in storage.items" :key="it.id">
          <!-- Click to select -->
          <v-group
            :config="{ x: it.x + it.w/2, y: it.y + it.h/2, rotation: it.rotation }"
            @click="emit('select', it.id)"
            @mouseenter="() => hoverId = it.id"
            @mouseleave="() => hoverId = (hoverId===it.id ? null : hoverId)"
          >
            <v-rect :config="{ x: -it.w/2, y: -it.h/2, width: it.w, height: it.h, cornerRadius: 8, stroke: props.selectedId===it.id ? '#93c5fd' : undefined, strokeWidth: props.selectedId===it.id ? 2 : 0 }" />
            <v-text :config="{ x: 0, y: 0, offsetX: 10, offsetY: 12, text: it.emoji, fontSize: 20 }" />

            <!-- Hover tooltip with a short list of contents -->
            <v-label v-if="hoverId===it.id" :config="{ x: it.w/2 + 8, y: -it.h/2 - 8, opacity: 0.95 }">
              <v-tag :config="{ fill: 'rgba(15,23,42,0.9)', stroke: '#334155', cornerRadius: 8, shadowColor: 'black', shadowBlur: 8, shadowOpacity: 0.25 }" />
              <v-text :config="{ text: (it.name ? (it.name + '\n') : '') + linesFor(it), fontSize: 14, padding: 8, fill: '#e5e7eb', lineHeight: 1.2 }" />
            </v-label>
          </v-group>
        </template>
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
