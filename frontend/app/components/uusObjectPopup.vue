<template>
  <UModal v-model:open="open" title="Muuda mööbli nime ja sisu" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div>
        <div class="mb-4">
          <UInput v-model="unitName" label="Üksuse nimi" placeholder="Mööbli nimi" />
        </div>
        
        <div class="list">
          <div v-for="(row, i) in rows" :key="i" class="row" :class="{ 'highlight-inuse': highlightedRows.has(i) }">
            <UInput v-model="row.name" placeholder="Eseme nimi" />
            
            <div class="qty-wrap">
              <UButton size="xs" variant="outline" @click="dec(i)">-</UButton>
              <UInput v-model.number="row.quantity" type="number" class="qty" :min="1" />
              <UButton size="xs" variant="outline" @click="inc(i)">+</UButton>
            </div>

            <div class="inuse-col">
              <div class="inuse-label">Kasutuses</div>
              <div class="inuse-wrap">
                <UButton size="xs" variant="outline" @click="decInUse(i)">-</UButton>
                <UInput 
                  v-model.number="row.inUse" 
                  type="number" 
                  class="qty"
                  :min="0"
                  :max="row.quantity || 1"
                />
                <UButton size="xs" variant="outline" @click="incInUse(i)">+</UButton>
              </div>
            </div>

            <UButton color="error" variant="outline" size="sm" @click="remove(i)">Kustuta</UButton>
          </div>
        </div>
        <UAlert v-if="showNameError" color="error" title="Nimi ei saa olla tühi." />
        <UAlert v-if="showError" color="error" title="Kogus peab olema vähemalt 1." />
      </div>
    </template>

    <template #footer="{ close }">
      <UButton @click="add">Lisa ese</UButton>
      <div class="spacer" />
      <UButton @click="close">Tühista</UButton>
      <UButton color="success" @click="save">Salvesta</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useStorageStore, type StoredObject } from '~/stores/storageStore'

const props = defineProps<{ unitId: number | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const store = useStorageStore()

const open = ref(false)
const unit = computed(() => store.items.find(i => i.id === props.unitId))
const unitName = ref('')
const rows = ref<StoredObject[]>([])
const showError = ref(false)
const showNameError = ref(false)

watch(() => props.unitId, v => { open.value = v !== null }, { immediate: true })
watch(open, v => { if (!v) emit('close') })

watch(unitName, (v) => { if (v && v.trim() !== '') showNameError.value = false })
watch(rows, (r) => {
  const allNamesOk = r.every(x => (x.name ?? '').toString().trim() !== '')
  if (allNamesOk) showNameError.value = false
}, { deep: true })

const add = () => { 
  rows.value.push({ name: 'Ese', quantity: 1, inUse: 0 }) 
}
const remove = (i: number) => rows.value.splice(i, 1)

const inc = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  r.quantity = Number.isInteger(r.quantity) ? r.quantity + 1 : 1
}

const dec = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  const cur = Number.isInteger(r.quantity) ? r.quantity : 1
  r.quantity = Math.max(1, cur - 1)
}

const incInUse = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  const cur = Number.isInteger(r.inUse) ? r.inUse : 0
  r.inUse = Math.min(r.quantity || 1, cur + 1)
}

const decInUse = (i: number) => {
  const r = rows.value[i]
  if (!r) return
  const cur = Number.isInteger(r.inUse) ? r.inUse : 0
  r.inUse = Math.max(0, cur - 1)
}

watch(rows, (newRows) => {
  newRows.forEach((row, i) => {
    if (row.inUse !== undefined) {
      row.inUse = Math.max(0, Math.min(row.inUse || 0, row.quantity || 1))
    }
  })
}, { deep: true })

watch(unit, (u) => {
  unitName.value = (u as any)?.name || ''
  rows.value = (u as any)?.contents?.map((x: any) => ({ 
    name: x.name, 
    quantity: x.quantity, 
    inUse: x.inUse || 0 
  })) || []
}, { immediate: true })

const save = async () => {
  showNameError.value = false
  showError.value = false
  const unitNameEmpty = !unitName.value || unitName.value.trim() === ''
  const someItemNameEmpty = rows.value.some(r => !(r.name ?? '').toString().trim())
  if (unitNameEmpty || someItemNameEmpty) {
    showNameError.value = true
    return
  }

  const valid = rows.value.every(r => Number.isInteger(r.quantity) && r.quantity >= 1)
  if (!valid) { showError.value = true; return }
  await store.setContents(unit.value!.id, rows.value)
  await store.updateUnit(unit.value!.id, { name: unitName.value })
  await store.saveToServer()
  emit('close')
}

const highlightedRows = computed(() => {
  if (!store.highlightedInUse?.unitId || store.highlightedInUse.unitId !== props.unitId) {
    return new Set<number>()
  }
  return new Set(
    rows.value.map((row, i) => (row.inUse || 0) > 0 ? i : -1).filter(i => i >= 0)
  )
})

</script>

<style scoped>
.list { 
  display: grid; 
  gap: 12px; 
}

.row { 
  display: grid; 
  grid-template-columns: 120px 120px 120px 60px; 
  gap: 12px; 
  align-items: end; 
}

.qty-wrap, .inuse-wrap { 
  display: grid; 
  grid-template-columns: 28px 56px 28px; 
  gap: 4px; 
  align-items: center; 
  width: 100%;
}

.qty { 
  width: 100%; 
  font-size: 14px;
}

.inuse-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.inuse-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  margin-bottom: 1px;
}

.inuse-wrap {
  width: 100%;
}

.row.highlight-inuse {
  background: transparent;
}

.row.highlight-inuse .inuse-wrap {
  background: linear-gradient(90deg, rgba(234,179,8,0.25), rgba(234,179,8,0.4));
  border: 2px solid rgba(234,179,8,0.6);
  border-radius: 6px;
  padding: 2px;
  margin-right: -4px;   
  width: calc(100% + 8px); 
  animation: pulse-highlight 1s infinite;
}

.row.highlight-inuse .inuse-label {
  color: #eab308;
  font-weight: 700;
}

@keyframes pulse-highlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(234,179,8,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(234,179,8,0); }
}

.spacer { flex: 1; }
</style>
