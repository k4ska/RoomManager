<template>
  <aside class="sidebar">
    <h3>Hoiustamise üksused</h3>
    <div class="items">
      <div
        v-for="it in list"
        :key="it.type"
        class="item"
        draggable="true"
        @dragstart="(e) => onDragStart(it, e)"
        @click="quickAdd(it)"
        :title="it.label"
      >
        <span class="emoji">{{ it.emoji }}</span>
        <span class="label">{{ it.label }}</span>
      </div>
    </div>
    <div class="help">Lohista lõuendile või klõpsa lisamiseks.</div>
  </aside>
  
</template>

<script setup lang="ts">
import type { StorageType } from '~/stores/storageStore'
import { useStorageStore } from '~/stores/storageStore'

const store = useStorageStore()

// Source of truth for selector + canvas
const list = [
  { type: 'box',       label: 'Kast',            emoji: '📦' },
  { type: 'cabinet',   label: 'Kapp',            emoji: '🗄️' },
  { type: 'shelf',     label: 'Riiul',           emoji: '🪜' },
  { type: 'table',     label: 'Laud',            emoji: '⛩' },
  { type: 'drawer',    label: 'Sahtel',          emoji: '🗃️' },
  { type: 'locker',    label: 'Kapp (lukuga)',   emoji: '🔒' },
  { type: 'workbench', label: 'Töölaud',         emoji: '🛠️' }
] as { type: StorageType, label: string, emoji: string }[]

function onDragStart(item: { type: StorageType, emoji: string }, e: DragEvent) {
  const payload = JSON.stringify({ type: item.type, emoji: item.emoji })
  e.dataTransfer?.setData('application/json', payload)
  e.dataTransfer?.setData('text/plain', item.type)
  e.dataTransfer?.setDragImage?.(new Image(), 0, 0)
}

function quickAdd(item: { type: StorageType, emoji: string }) {
  store.addUnit(item.type, 40, 40, item.emoji)
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  max-height: calc(100vh - 140px);
  overflow: auto;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 12px;
  background: rgba(15,23,42,0.85);
  box-sizing: border-box;
}
h3 { margin: 0 0 8px 0; font-size: 1.05rem; }
.items { display: grid; gap: 8px; }
.item {
  display: flex; align-items: center; gap: 10px;
  background: rgba(148,163,184,0.12);
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: grab;
  user-select: none;
}
.item:hover { background: rgba(148,163,184,0.22); }
.emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  font-size: 1.25rem;
  line-height: 1;
}
.label { line-height: 1.2; }
.help { color: #9ca3af; margin-top: 10px; font-size: .9rem; }
</style>

