import { defineStore } from 'pinia'

export type StorageType = 'box' | 'cabinet' | 'shelf' | 'table' | 'drawer' | 'locker' | 'workbench'
export type StorageKind = StorageType | 'custom' | string

export interface StoredObject { id: number; name: string; quantity: number; isTaken: boolean }

export interface StorageUnit {
  id: number
  type: StorageKind
  x: number // top-left
  y: number // top-left
  w: number
  h: number
  rotation: number // degrees 0..359
  emoji: string
  name?: string
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
  const currentRoomId = ref<number | null>(null)
  const highlightedItemId = ref<number | null>(null)

  const runtime = (useRuntimeConfig?.() as any)
  const publicCfg = runtime.public
  const publicApiBase = publicCfg.apiBase

  // Teisendab backendist tulnud üksuse ja esemed kohalikuks StorageUnit-iks
  function mapUnit(u: any): StorageUnit {
    return {
      id: u.id,
      type: u.type as StorageKind,
      x: u.x,
      y: u.y,
      w: u.w,
      h: u.h,
      rotation: u.rotation,
      emoji: u.emoji,
      name: u.name ?? undefined,
      contents: (u.items || []).map((it: any) => ({ id: it.id, name: it.name, quantity: it.quantity, isTaken: it.isTaken }))
    }
  }

  // Veendub, et kasutajal on tuba; vajadusel loob uue
  async function ensureRoom(): Promise<number> {
    if (currentRoomId.value) return currentRoomId.value
    const res = await fetch(`${publicApiBase}/api/rooms`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && data.rooms?.length) {
      currentRoomId.value = data.rooms[0].id
      return currentRoomId.value
    }
    const create = await fetch(`${publicApiBase}/api/rooms`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Minu tuba' })
    })
    const payload = await create.json()
    currentRoomId.value = payload?.room?.id ?? null
    return currentRoomId.value as number
  }

  // Laeb aktiivse toa üksused backendist
  async function loadUnits() {
    const roomId = await ensureRoom()
    const res = await fetch(`${publicApiBase}/api/rooms/${roomId}/units`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && Array.isArray(data.units)) {
      items.value = data.units.map(mapUnit)
    }
  }

  


  // Adds a new storage unit to the canvas
  async function addUnit(type: StorageKind, x: number, y: number, emojiOverride?: string, nameOverride?: string) {
    const meta = META[type as StorageType] ?? { w: UNIT_SIZE, h: UNIT_SIZE, emoji: emojiOverride ?? '🧩' }
    const optimistic: StorageUnit = {
      id: idSeq++,
      type,
      x,
      y,
      w: meta.w,
      h: meta.h,
      rotation: 0,
      emoji: (emojiOverride ?? meta.emoji),
      name: nameOverride ?? (LABEL ? LABEL[type as StorageType] : undefined),
      contents: []
    }
    items.value.push(optimistic)
    return optimistic.id
  }

  // Uuendab olemasolevat üksust osalise parandusega
  async function updateUnit(id: number, patch: Partial<Omit<StorageUnit, 'id' | 'type' | 'emoji'>>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    Object.assign(it, patch)
    // Defer server sync to saveToServer
  }

  // Uuendab üksuse ainult asukohta
  function updatePos(id: number, x: number, y: number) { return updateUnit(id, { x: Math.round(x), y: Math.round(y) }) }

  // Eemaldab üksuse ID alusel
  async function removeUnit(id: number) {
    items.value = items.value.filter(i => i.id !== id)
    // Defer server sync to saveToServer
  }

  async function deleteUnit(id: number) {
  items.value = items.value.filter(i => i.id !== id)
  try { 
    await fetch(`${publicApiBase}/api/units/${id}`, { 
      method: 'DELETE', 
      credentials: 'include' 
    }) 
  } catch {}
}
  // Clears all units
  async function clear() {
    const ids = items.value.map(i => i.id)
    items.value = []
    // Defer server sync to saveToServer
  }

  // Asendab üksuse sisu massiivi
  async function setContents(id: number, contents: StoredObject[]) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents = contents
    // Defer server sync to saveToServer
  }

  // Lisab üksusele ühe sisu-elemendi
  async function addContent(id: number, item?: Partial<StoredObject>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    const obj = { name: item?.name ?? 'Ese', quantity: item?.quantity ?? 1 }
    it.contents.push(obj)
    // Defer server sync to saveToServer
  }

  // Eemaldab sisu-elemendi indeksi alusel
  async function removeContent(id: number, index: number) {
    const it = items.value.find(i => i.id === id)
    if (!it || index < 0 || index >= it.contents.length) return
    it.contents.splice(index, 1)
  }

  // Salvestab praeguse üksuste pildi backendis (turvaline täielik asendus)
  async function saveToServer(): Promise<boolean> {
    try {
      const payload = { units: items.value.map(u => ({
        type: u.type,
        x: Math.round(u.x),
        y: Math.round(u.y),
        w: Math.round(u.w),
        h: Math.round(u.h),
        rotation: Math.round(u.rotation || 0),
        emoji: u.emoji,
        name: u.name,
        contents: (u.contents || []).map(c => ({ name: c.name, quantity: Math.max(1, Math.round(c.quantity || 1)) }))
      })) }
      const res = await fetch(`${publicApiBase}/api/layout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const text = await res.text()
      if (!res.ok) {
        console.error('saveToServer error', res.status, text)
        return false
      }
      // Püüab vastust parsida kinnituseks (200 OK puhul võib keha olla tühi)
      try { const data = JSON.parse(text); if (!(data && data.ok)) return false } catch (e) { /* backend võib tagastada tühja keha; 200 = OK */ }
      return true
    } catch (e) {
      console.error('saveToServer failed', e)
      return false
    }
  }

  async function toggleItemStatus(itemId: number, currentStatus: boolean) {
      const res = await fetch(`${publicApiBase}/api/items/${itemId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isTaken: !currentStatus }),
          credentials: 'include'
      })
      const data = await res.json()
      if (data.ok) {
          await loadUnits()
      }
  }

  async function updateItem(itemId: number, dto: { name?: string, quantity?: number, furnitureId?: number }) {
      const res = await fetch(`${publicApiBase}/api/items/${itemId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(dto),
          credentials: 'include'
      })
      const data = await res.json()
      if (data.ok) {
          await loadUnits()
      }
  }

  return {
    items, currentRoomId, highlightedItemId,
    ensureRoom, loadUnits,
    addUnit, updateUnit,
    updatePos, removeUnit,
    clear, setContents,
    addContent, removeContent,
    saveToServer, deleteUnit,
    toggleItemStatus, updateItem
  }
})
