import { defineStore } from 'pinia'

export type StorageType = 'box' | 'cabinet' | 'shelf' | 'table' | 'drawer' | 'locker' | 'workbench'

export interface StoredObject { name: string; quantity: number }

export interface StorageUnit {
  id: number
  type: StorageType
  x: number // top-left
  y: number // top-left
  w: number
  h: number
  rotation: number // degrees 0..359
  emoji: string
  contents: StoredObject[]
}

let idSeq = 1

// Use a universaalne ruut kõigile üksustele
export const UNIT_SIZE = 56

// Estonian default labels for unit types
const LABEL: Record<StorageType, string> = {
  box: 'Kast',
  cabinet: 'Kapp',
  shelf: 'Riiul',
  table: 'Laud',
  drawer: 'Sahtel',
  locker: 'Kapp (lukuga)',
  workbench: 'Töölaud'
}

// Emoji mapping per spec
const META: Record<StorageType, { w: number; h: number; emoji: string }> = {
  box: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '📦' },
  cabinet: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🗄️' },
  shelf: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🪟' },
  table: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🪑' },
  drawer: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🧰' },
  locker: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🔒' },
  workbench: { w: UNIT_SIZE, h: UNIT_SIZE, emoji: '🛠️' }
}

export const useStorageStore = defineStore('storage', () => {
  const items = ref<StorageUnit[]>([])

  function addUnit(type: StorageType, x: number, y: number, emojiOverride?: string) {
    const meta = META[type]
    const unit: StorageUnit = { id: idSeq++, type, x, y, w: meta.w, h: meta.h, rotation: 0, emoji: (emojiOverride ?? meta.emoji), name: (LABEL ? LABEL[type] : undefined), contents: [] }
    items.value.push(unit)
    return unit.id
  }

  function updateUnit(id: number, patch: Partial<Omit<StorageUnit, 'id' | 'type' | 'emoji'>>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    Object.assign(it, patch)
  }

  function updatePos(id: number, x: number, y: number) { updateUnit(id, { x, y }) }

  function removeUnit(id: number) {
    items.value = items.value.filter(i => i.id !== id)
  }

  function clear() { items.value = [] }

  function setContents(id: number, contents: StoredObject[]) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents = contents
  }

  function addContent(id: number, item?: Partial<StoredObject>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents.push({ name: item?.name ?? 'Ese', quantity: item?.quantity ?? 1 })
  }

  function removeContent(id: number, index: number) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents.splice(index, 1)
  }

  return { items, addUnit, updateUnit, updatePos, removeUnit, clear, setContents, addContent, removeContent }
})
