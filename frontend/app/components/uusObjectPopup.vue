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

// Open modal when a unit is selected (run immediately on mount)
watch(() => props.unitId, v => { open.value = v !== null }, { immediate: true })
// Emit close when modal is closed
watch(open, v => { if (!v) emit('close') })

// Populate form when unit changes (assume unit exists when popup is opened)
watch(unit, (u) => {
  // use `any` here because popup is only opened for a selected unit
  unitName.value = (u as any).name
  rows.value = (u as any).contents.map((x: any) => ({ ...x }))
}, { immediate: true })

// Clear name error when user types
watch(unitName, (v) => { if (v && v.trim() !== '') showNameError.value = false })
watch(rows, (r) => {
  const allNamesOk = r.every(x => (x.name ?? '').toString().trim() !== '')
  if (allNamesOk) showNameError.value = false
}, { deep: true })

const add = () => { rows.value.push({ name: 'Ese', quantity: 1 }) }
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

const save = async () => {
  // Validate names first: unit name and every item name must be non-empty
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
  // Assume `unit` exists because the popup only opens for a selected item
  await store.setContents(unit.value!.id, rows.value)
  await store.updateUnit(unit.value!.id, { name: unitName.value })
  await store.saveToServer()
  emit('close')
}
</script>

<template>
  <UModal v-model:open="open" title="Muuda mööbli nime ja sisu" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div>
        <div class="mb-4">
          <UInput v-model="unitName" label="Üksuse nimi" placeholder="Mööbli nimi" />
        </div>

        <div class="list">
          <div v-for="(row, i) in rows" :key="i" class="row">
            <UInput v-model="row.name" placeholder="Eseme nimi" />

            <div class="qty-wrap">
              <UButton size="xs" variant="outline" @click="dec(i)">-</UButton>
              <UInput v-model.number="row.quantity" type="number" class="qty" placeholder="Kogus" />
              <UButton size="xs" variant="outline" @click="inc(i)">+</UButton>
            </div>

            <UButton color="error" variant="outline" @click="remove(i)">Kustuta</UButton>
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

<style scoped>
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
.qty { 
  width: 100%; 
}
.qty-wrap { 
  display: grid; 
  grid-template-columns: 36px minmax(48px,1fr) 36px; 
  gap: 8px; 
  align-items: center; 
}
.spacer { 
  flex: 1; 
}
.empty { 
  color: #9ca3af; 
  text-align: center; 
  padding: 24px; 
  }
</style>

