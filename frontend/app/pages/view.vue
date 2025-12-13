<template>
  <div class="view-wrap">
    <header class="head">
      <h1>Ruumivaade</h1>
      <div class="search-row">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Otsi esemete järgi (nt „Pliiats”)"
            @keydown.enter.prevent="submitSearch"
          >

          <div v-if="showSuggestions" class="suggestions">
            <button
              v-for="option in suggestions"
              :key="option.label"
              class="suggestion"
              type="button"
              @mousedown.prevent="pickSuggestion(option)"
            >
              <span class="name">{{ option.label }}</span>
              <span class="count">{{ option.unitIds.size }} asukoht(a)</span>
            </button>
          </div>
        </div>
        <p class="search-hint">
        </p>
      </div>
      <div class="actions">
        <NuxtLink class="btn secondary" to="/rooms">Toad</NuxtLink>
        <NuxtLink class="btn" to="/storage">Muuda paigutust</NuxtLink>
      </div>
    </header>

    <section class="canvas-card">
      <ClientOnly>
        <ViewCanvas
          :selected-id="selectedId"
          :highlight-ids="highlightedIds"
          @select="id => { selectedId = id; showPopup = id !== null }"
        />
      </ClientOnly>
    </section>

    <UusObjectPopup v-if="showPopup" :unit-id="selectedId" @close="showPopup=false" />
  </div>
</template>

<script setup lang="ts">
import ViewCanvas from '~/components/ViewCanvas.vue'
import UusObjectPopup from '~/components/uusObjectPopup.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useStorageStore } from '~/stores/storageStore'
import { useRoomShapeStore } from '~/stores/roomShape'


// Vaateleht on avalik (kiire juurdepääs avalehelt)
const selectedId = ref<number | null>(null)
const showPopup = ref(false)
const searchQuery = ref('')
const highlightedIds = ref<number[]>([])

// Laeb salvestatud toakuju ja üksused ainult lugemiseks
const shape = useRoomShapeStore()
const store = useStorageStore()

type Suggestion = { label: string; unitIds: Set<number> }

const indexedObjects = computed<Suggestion[]>(() => {
  const map = new Map<string, Suggestion>()
  for (const unit of store.items) {
    for (const obj of unit.contents ?? []) {
      const label = (obj.name ?? '').toString().trim()
      if (!label) continue
      const key = label.toLowerCase()
      const existing = map.get(key) ?? { label, unitIds: new Set<number>() }
      existing.unitIds.add(unit.id)
      map.set(key, existing)
    }
  }
  return Array.from(map.values())
})

const suggestions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return indexedObjects.value
    .filter(opt => opt.label.toLowerCase().includes(q))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 8)
})

const showSuggestions = computed(() => searchQuery.value.trim() !== '' && suggestions.value.length > 0)

let detachInteractionClear: (() => void) | null = null

function installInteractionClear() {
  if (typeof window === 'undefined') return
  if (detachInteractionClear) detachInteractionClear()
  const handler = () => {
    highlightedIds.value = []
    if (detachInteractionClear) {
      detachInteractionClear()
      detachInteractionClear = null
    }
  }
  setTimeout(() => {
    window.addEventListener('pointerdown', handler, { once: true, capture: true })
    window.addEventListener('keydown', handler, { once: true, capture: true })
    detachInteractionClear = () => {
      window.removeEventListener('pointerdown', handler, true)
      window.removeEventListener('keydown', handler, true)
    }
  }, 0)
}

onBeforeUnmount(() => {
  if (detachInteractionClear) detachInteractionClear()
})

function highlightUnits(term: string, preferredIds?: number[]) {
  const needle = term.trim()
  if (!needle) return
  const lower = needle.toLowerCase()
  const ids = new Set<number>()

  if (preferredIds?.length) {
    preferredIds.forEach(id => ids.add(id))
  } else {
    for (const unit of store.items) {
      const matches = (unit.contents ?? []).some(obj => (obj.name ?? '').toLowerCase().includes(lower))
      if (matches) ids.add(unit.id)
    }
  }

  highlightedIds.value = Array.from(ids)
  searchQuery.value = ''
  installInteractionClear()
}

function submitSearch() {
  highlightUnits(searchQuery.value)
}

function pickSuggestion(option: Suggestion) {
  highlightUnits(option.label, Array.from(option.unitIds))
}

onMounted(async () => {
  try {
    const roomId = await store.ensureRoom()
    await shape.loadFromServer(roomId)
    await store.loadUnits()
  } catch {}
})
</script>

<style scoped>
.view-wrap { 
  min-height: 100vh; 
  max-width: 1080px; 
  margin: 0 auto; 
  padding: 20px; 
}
.head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.canvas-card { 
  background: rgba(17,24,39,0.8); 
  border: 1px solid #334155; 
  border-radius: 16px; 
  padding: 12px; 
}
.actions { 
  display: flex; 
  gap: 8px; 
}
.btn { 
  background: var(--accent); 
  color: #062217; 
  border-radius: 10px; 
  padding: 8px 12px; 
  font-weight: 700; 
  text-decoration: none; 
  border: none; 
  cursor: pointer; 
}
.btn:hover { 
  background: var(--accent-hover); 
}
.btn.secondary {
  background: rgba(148,163,184,0.15);
  color: var(--text);
}
.btn.secondary:hover { background: rgba(148,163,184,0.25); }
.btn:disabled { 
  opacity: .5; 
  cursor: not-allowed; 
}

.search-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.search-box {
  position: relative;
  display: block;
}
.search-input {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #334155;
  padding: 8px 12px;
  background: rgba(15,23,42,0.9);
  color: #e5e7eb;
  font-size: 15px;
}
.search-input::placeholder { color: #9ca3af; }
.suggestions {
  position: absolute;
  inset: calc(100% + 6px) 0 auto 0;
  background: rgba(15,23,42,0.95);
  border: 1px solid #334155;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  padding: 6px;
  display: grid;
  gap: 4px;
  z-index: 10;
}
.suggestion {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(148,163,184,0.08);
  color: #e5e7eb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.suggestion:hover {
  border-color: #334155;
  background: rgba(148,163,184,0.16);
}
.suggestion .name { font-weight: 700; }
.suggestion .count { color: #9ca3af; font-size: 13px; }
.search-hint {
  color: #9ca3af;
  margin: 0;
  font-size: 0.9rem;
}
</style>
