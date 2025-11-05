<template>
  <div class="backdrop">
    <div class="modal" @click.stop>
      <h3>Üksuse sisu</h3>
      <div v-if="unit" class="list">
        <div class="row single">
          <input class="inp" v-model="unitName" placeholder="Üksuse nimi (nt Laud akna all)" />
        </div>
        <div v-for="(row, i) in rows" :key="i" class="row">
          <input class="inp" v-model="row.name" placeholder="Ese (nt Pliiatsid)" />
          <div class="qty-wrap">
            <button class="icon" @click="dec(i)">-</button>
            <input class="inp qty" type="number" min="1" v-model.number="row.quantity" />
            <button class="icon" @click="inc(i)">+</button>
          </div>
          <button class="btn danger" @click="remove(i)">Kustuta</button>
        </div>
        <div v-if="showError" class="error-text">Kogus peab olema vähemalt 1.</div>
        <div class="actions">
          <button class="btn" @click="add">Lisa ese</button>
          <div class="spacer" />
          <button class="btn" @click="$emit('close')">Tühista</button>
          <button class="btn success" @click="save">Salvesta</button>
        </div>
      </div>
      <div v-else class="empty">Üksus valimata</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStorageStore, type StoredObject } from '~/stores/storageStore'

const props = defineProps<{ unitId: number | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useStorageStore()
// Leiab valitud hoiustamisüksuse ID järgi
const unit = computed(() => store.items.find(i => i.id === props.unitId))
const unitName = ref('')
const rows = ref<StoredObject[]>([])
const showError = ref(false)

// Uuendab vormi välju, kui valitud üksus muutub
watch(unit, (u) => {
  unitName.value = u?.name ?? ''
  rows.value = u ? u.contents.map(x => ({ ...x })) : []
}, { immediate: true })

// Lisab uue tühja rea
const add = () => rows.value.push({ name: 'Ese', quantity: 1 })
// Eemaldab rea indeksi alusel
const remove = (i: number) => rows.value.splice(i, 1)
// Suurendab rea kogust (kaitsev kontroll kehtetu indeksi vastu)
const inc = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  r.quantity = Number.isInteger(r.quantity) ? r.quantity + 1 : 1
}
// Vähendab rea kogust (miinimum 1) koos kaitsekontrollidega
const dec = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  const cur = Number.isInteger(r.quantity) ? r.quantity : 1
  r.quantity = Math.max(1, cur - 1)
}
// Kontrollib andmed ja salvestab muudatused poodi
const save = async () => {
  const valid = rows.value.every(r => Number.isInteger(r.quantity) && r.quantity >= 1)
  if (!valid) { showError.value = true; return }
  // Do not block save with popups; allow default names as-is
  if (unit.value) {
    await store.setContents(unit.value.id, rows.value)
    await store.updateUnit(unit.value.id, { name: unitName.value })
    // Salvesta kohe, et sisu ei kaoks navigeerimisel
    await store.saveToServer()
  }
  emit('close')
}
</script>

<style scoped>
.backdrop { 
  position: fixed; 
  inset: 0; 
  background: rgba(0,0,0,0.55); 
  display: grid; 
  place-items: center; 
}
.modal { 
  width: 640px; 
  max-width: 95vw; 
  background: #0f172a; 
  border: 1px solid #334155; 
  border-radius: 16px; 
  padding: 16px; 
  color: var(--text); 
}
h3 { 
  margin: 0 0 12px 0; 
}
.list { 
  display: grid; 
  gap: 8px; 
}
.row { 
  display: grid; 
  grid-template-columns: 1fr 200px 120px; 
  gap: 12px; 
  align-items: center; 
}
.row.single { 
  grid-template-columns: 1fr; 
}
.inp { 
  background: rgba(148,163,184,0.12); 
  border: 1px solid #334155; 
  border-radius: 10px; 
  padding: 8px 10px; 
  color: var(--text); 
  box-sizing: border-box; 
}
.qty { 
  text-align: right; 
}
.qty-wrap { 
  display: grid; 
  grid-template-columns: 36px minmax(48px,1fr) 36px; 
  gap: 8px; 
  align-items: center; 
}
.icon { 
  height: 36px; 
  border-radius: 8px; 
  background: rgba(148,163,184,0.18); 
  border: 1px solid #334155; 
  color: var(--text); 
  font-weight: 800; 
  font-size: 18px; 
}
.icon:hover { 
  background: rgba(148,163,184,0.28); 
}
.actions { 
  display: flex; 
  gap: 8px; 
  margin-top: 10px; 
}
.spacer { 
  flex: 1; 
}
.btn { 
  background: rgba(148,163,184,0.15); 
  color: var(--text); 
  border: 1px solid #334155; 
  padding: 8px 12px; 
  border-radius: 10px; 
  font-weight: 700; 
  white-space: nowrap; 
}
.btn:hover { 
  background: rgba(148,163,184,0.25); 
}
.btn.success { 
  background: var(--accent); 
  color: #062217; 
  border-color: transparent; 
}
.btn.success:hover { 
  background: var(--accent-hover); 
}
.btn.danger { 
  background: rgba(244,63,94,0.15); 
  border-color: #7f1d1d; 
  min-width: 96px; 
}
.btn.danger:hover { 
  background: rgba(244,63,94,0.25); 
}
.empty { 
  color: #9ca3af; 
  text-align: center; 
  padding: 24px; 
}
.error-text { 
  font-size: 13px; 
  color: #f87171; 
  margin-top: 4px; 
}
</style>
