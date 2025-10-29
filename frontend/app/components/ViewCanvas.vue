<script setup lang="ts">
import { ref } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'

const room = useRoomShapeStore()
const storage = useStorageStore()
const props = defineProps<{ selectedId?: number | null }>()
const emit = defineEmits<{ (e: 'select', id: number): void }>()

const hoverId = ref<number | null>(null)

// Builds a short multi-line summary of unit contents
function linesFor(item: { contents?: { name: string; quantity: number }[] }) {
  const items = item.contents ?? []
  if (!items.length) return 'Tühi'
  const max = 3
  const shown = items.slice(0, max).map(x => `${x.name} × ${x.quantity}`)
  const extra = items.length - shown.length
  return extra > 0 ? shown.concat([`+${extra} veel`]).join('\n') : shown.join('\n')
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
        <template v-for="item in storage.items" :key="item.id">
          <!-- Click to select -->
          <v-group
            :config="{ x: item.x + item.w/2, y: item.y + item.h/2, rotation: item.rotation }"
            @click="emit('select', item.id)"
            @mouseenter="() => hoverId = item.id"
            @mouseleave="() => hoverId = (hoverId===item.id ? null : hoverId)"
          >
            <v-rect :config="{ x: -item.w/2, y: -item.h/2, width: item.w, height: item.h, cornerRadius: 8, stroke: props.selectedId===item.id ? '#93c5fd' : undefined, strokeWidth: props.selectedId===item.id ? 2 : 0 }" />
            <v-text :config="{ x: 0, y: 0, offsetX: 10, offsetY: 12, text: item.emoji, fontSize: 20 }" />

          </v-group>

          <!-- Hover tooltip rendered with absolute coords so it doesn't move/rotate with the object -->
          <v-label v-if="hoverId===item.id" :config="{ x: item.x + item.w + 8, y: item.y - 8, opacity: 0.95 }">
            <v-tag :config="{ fill: 'rgba(15,23,42,0.9)', stroke: '#334155', cornerRadius: 8, shadowColor: 'black', shadowBlur: 8, shadowOpacity: 0.25 }" />
            <v-text :config="{ text: (item.name ? (item.name + '\n') : '') + linesFor(item), fontSize: 14, padding: 8, fill: '#e5e7eb', lineHeight: 1.2 }" />
          </v-label>
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

