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
const PADDING = 4
const isIconifyName = (val: string) => /^[-a-z0-9]+:[-a-z0-9]+$/i.test(val);
const imageCache = new Map<string, HTMLImageElement | null>()
const highlightSet = computed(() => new Set(props.highlightIds ?? []))

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
    <div class="canvas-container" :style="{ width: room.stage.width + 'px', height: room.stage.height + 'px' }">
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
          <template v-for="item in storage.items" :key="item.id">
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
                fill: 'rgba(148,163,184,0.12)',
                stroke: hoverId===item.id ? '#93c5fd' : '#334155',
                strokeWidth: hoverId===item.id ? 2 : 1
              }" />
            </v-group>

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

            <div 
        v-for="item in storage.items" 
        :key="'emoji-' + item.id"
        class="emoji-overlay"
        :style="{
          left: item.x + 'px',
          top: item.y + 'px',
          width: item.w + 'px',
          height: item.h + 'px',
          transform: 'rotate(' + item.rotation + 'deg)',
          fontSize: (item.w - PADDING) + 'px',
          lineHeight: (item.h - PADDING) + 'px'
        }"

 >
        <Icon v-if="isIconifyName(item.emoji)" :name="item.emoji" />
        <span v-else>{{ item.emoji }}</span>
      </div>
    </div>
  </div>
</template>


<style scoped>
.canvas-wrap { 
  display: flex; 
  justify-content: center; 
}

.canvas-container {
  position: relative;
}

.emoji-overlay {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
  user-select: none;
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "NotoColorEmoji", "Segoe UI Symbol", sans-serif;
}

</style>
