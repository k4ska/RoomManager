<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
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
const inUseNotification = ref('')

const updateInUseNotification = () => {
  const unitsWithInUse = storage.items.filter(item => {
    const contents = item.contents || []
    return contents.some(content => (content.inUse || 0) > 0)
  })

  if (unitsWithInUse.length > 0) {
    const unitInfo = unitsWithInUse.slice(0, 3).map(item => {
      const contents = item.contents || []
      const inUseItems = contents.filter(content => (content.inUse || 0) > 0)
      return inUseItems.slice(0, 2).map(content => {
        return `${item.name || 'Mööbel'}: tagasta ${content.name || 'ese'} (${content.inUse || 0})`
      }).join('\n')
    }).flat().join('\n')
    inUseNotification.value = unitInfo
  } else {
    inUseNotification.value = ''
  }
}

watch(() => storage.items, updateInUseNotification, { deep: true })
onMounted(updateInUseNotification)

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

const doorsWithPoints = computed(() => {
  try {
    return (room.doors || []).map((d: any, idx: number) => {
      const a = room.points[d.edgeIndex]
      const b = room.points[(d.edgeIndex + 1) % room.points.length]
      if (!a || !b) return { ...d, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, index: idx }
      
      const p1 = { x: a.x + (b.x - a.x) * (d.t1 ?? 0), y: a.y + (b.y - a.y) * (d.t1 ?? 0) }
      const p2 = { x: a.x + (b.x - a.x) * (d.t2 ?? 0), y: a.y + (b.y - a.y) * (d.t2 ?? 0) }

      const edgePerp = getWindowPerp(p1, p2)
      const capLen = 18

      const isInside = (d.direction || room.doorDirection) === 'inside'
      const nx = isInside ? edgePerp.nx : -edgePerp.nx
      const ny = isInside ? edgePerp.ny : -edgePerp.ny

      const lJuncVertStart = p1
      const lJuncVertEnd = { x: p2.x, y: p2.y }
      const lJuncCapEnd = { x: p1.x + nx * capLen, y: p1.y + ny * capLen }

      const curvePoints: number[] = []
      const midX = (lJuncCapEnd.x + p2.x) / 2
      const midY = (lJuncCapEnd.y + p2.y) / 2
      let cpOffset = 18
      const vecToMid = { x: midX - lJuncCapEnd.x, y: midY - lJuncCapEnd.y }
      const proj = vecToMid.x * nx + vecToMid.y * ny
      if (proj + cpOffset > capLen) cpOffset = Math.max(0, capLen - proj)
      const cpx = midX + nx * cpOffset
      const cpy = midY + ny * cpOffset

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

      return { ...d, p1, p2, lJuncVertStart, lJuncVertEnd, lJuncCapEnd, curvePoints, index: idx }
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

function linesFor(item: { contents?: { name: string; quantity: number; inUse?: number }[] }) {
  const items = item.contents ?? []
  if (!items.length) return 'Tühi'
  const max = 3
  const shown = items.slice(0, max).map(x => {
    const inUse = x.inUse || 0
    const available = (x.quantity || 0) - inUse
    return `${x.name}: ${available}/${x.quantity} (${inUse} kasutuses)`
  })
  const extra = items.length - shown.length
  return extra > 0 ? shown.concat([`+${extra} veel`]).join('\n') : shown.join('\n')
}

function isHighlighted(id: number) {
  return highlightSet.value.has(id)
}
</script>

<template>
  <div class="canvas-wrap">
    <div v-if="inUseNotification" class="in-use-notification">
      ⚠️ {{ inUseNotification }}
    </div>
    
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
        <template v-for="(door, idx) in doorsWithPoints" :key="'door' + door.index">
          <v-line
            :config="{
              points: [door.lJuncVertStart.x, door.lJuncVertStart.y, door.lJuncVertEnd.x, door.lJuncVertEnd.y],
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <v-line
            :config="{
              points: [door.lJuncVertStart.x, door.lJuncVertStart.y, door.lJuncCapEnd.x, door.lJuncCapEnd.y],
              stroke: '#e5e7eb',
              strokeWidth: 2,
              listening: false
            }"
          />
          <v-line
            :config="{
              points: door.curvePoints,
              stroke: '#fff',
              strokeWidth: 2.5,
              listening: false,
              lineCap: 'round'
            }"
          />
        </template>
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
  position: relative;
}

.in-use-notification {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
  z-index: 1000;
  max-width: 300px;
  backdrop-filter: blur(10px);
  white-space: pre-line;
}

.canvas-wrap :deep(.in-use-notification) {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.95; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}
</style>
