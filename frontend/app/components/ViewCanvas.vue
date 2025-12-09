<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'

const room = useRoomShapeStore()
const storage = useStorageStore()
const props = defineProps<{ selectedId?: number | null; highlightIds?: number[] | null }>()
const emit = defineEmits<{ (e: 'select', id: number | null): void }>()

const hoverId = ref<number | null>(null)
const EMOJI_SIZE = 20
const imageCache = new Map<string, HTMLImageElement | null>()
const highlightSet = computed(() => new Set(props.highlightIds ?? []))

// Helpers for windows rendering
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

function isImageEmoji(value: string | null | undefined) {
  return !!value && (value.startsWith('data:image') || value.startsWith('http'))
}

function getImage(value: string | null | undefined) {
  if (!isImageEmoji(value)) return null
  if (typeof Image === 'undefined') return null
  if (!imageCache.has(value!)) {
    const img = new Image()
    img.src = value!
    imageCache.set(value!, img)
  }
  return imageCache.get(value!) || null
}

// Builds a short multi-line summary of unit contents
function linesFor(item: { contents?: { name: string; quantity: number }[] }) {
  const items = item.contents ?? []
  if (!items.length) return 'Tühi'
  const max = 3
  const shown = items.slice(0, max).map(x => `${x.name} × ${x.quantity}`)
  const extra = items.length - shown.length
  return extra > 0 ? shown.concat([`+${extra} veel`]).join('\n') : shown.join('\n')
}

function isHighlighted(id: number) {
  return highlightSet.value.has(id)
}
</script>

<template>
  <div class="canvas-wrap">
    <v-stage :config="{
          width: room.stage.width,
          height: room.stage.height
        }">
      <v-layer>
        <v-rect :config="{
            x: 0,
            y: 0,
            width: room.stage.width,
            height: room.stage.height,
            fill: '#0b1222'
          }" @click="() => emit('select', null)" />
        <v-line
          :points="room.points.flatMap(p => [p.x, p.y])"
          :closed="true"
          :stroke="'#e5e7eb'"
          :strokeWidth="2.5"
          :fill="'rgba(16,185,129,0.06)'"
          @click="() => emit('select', null)"
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
        <template v-for="item in storage.items" :key="item.id">
          <!-- Click to select -->
          <v-group
            :config="{
              x: item.x + item.w/2,
              y: item.y + item.h/2,
              rotation: item.rotation
            }"
            @click="emit('select', item.id)"
            @mouseenter="() => hoverId = item.id"
            @mouseleave="() => hoverId = (hoverId===item.id ? null : hoverId)"
          >
            <v-rect :config="{
              x: -item.w/2,
              y: -item.h/2,
              width: item.w,
              height: item.h,
              cornerRadius: 8,
              stroke: isHighlighted(item.id) ? '#facc15' : (hoverId===item.id ? '#93c5fd' : undefined),
              strokeWidth: isHighlighted(item.id) ? 3 : (hoverId===item.id ? 2 : 0),
              shadowColor: isHighlighted(item.id) ? '#facc15' : undefined,
              shadowBlur: isHighlighted(item.id) ? 18 : 0,
              shadowOpacity: isHighlighted(item.id) ? 0.9 : 0
            }" />
            <v-image
              v-if="isImageEmoji(item.emoji)"
              :config="{
                x: -item.w/2,
                y: -item.h/2,
                width: item.w,
                height: item.h,
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
                fontSize: Math.max(EMOJI_SIZE, Math.min(item.w, item.h) * 0.5),
                fill: '#ffffff'
              }"
            />

          </v-group>

          <!-- Hover tooltip rendered with absolute coords so it doesn't move/rotate with the object -->
          <v-label v-if="hoverId===item.id" :config="{
              x: item.x + item.w + 8,
              y: item.y - 8,
              opacity: 0.95
            }">
            <v-tag :config="{
              fill: 'rgba(15,23,42,0.9)',
              stroke: '#334155',
              cornerRadius: 8,
              shadowColor: 'black',
              shadowBlur: 8,
              shadowOpacity: 0.25
            }" />
            <v-text :config="{
              text: (item.name ? (item.name + '\n') : '') + linesFor(item),
              fontSize: 14,
              padding: 8,
              fill: '#e5e7eb',
              lineHeight: 1.2
            }" />
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

