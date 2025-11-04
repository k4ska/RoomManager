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

  // Returns API base URL from env
  function apiBase() {
    // Nuxt 4 exposes public runtime as import.meta.env
    // Fallback to process.env for SSR/node contexts
    // @ts-ignore
    return (import.meta as any).env?.NUXT_PUBLIC_API_BASE || (process.env as any)?.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
  }

  // Converts backend unit+items to local StorageUnit
  function mapUnit(u: any): StorageUnit {
    return {
      id: u.id,
      type: u.type,
      x: u.x,
      y: u.y,
      w: u.w,
      h: u.h,
      rotation: u.rotation,
      emoji: u.emoji,
      name: u.name ?? undefined,
      contents: (u.items || []).map((it: any) => ({ name: it.name, quantity: it.quantity }))
    }
  }

  // Ensures the user has a room; creates one if needed
  async function ensureRoom(): Promise<number> {
    if (currentRoomId.value) return currentRoomId.value
    const res = await fetch(`${apiBase()}/api/rooms`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && data.rooms?.length) {
      currentRoomId.value = data.rooms[0].id
      return currentRoomId.value
    }
    const create = await fetch(`${apiBase()}/api/rooms`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Minu tuba' })
    })
    const payload = await create.json()
    currentRoomId.value = payload?.room?.id ?? null
    return currentRoomId.value as number
  }

  // Loads units for the current room from backend
  async function loadUnits() {
    const roomId = await ensureRoom()
    const res = await fetch(`${apiBase()}/api/rooms/${roomId}/units`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && Array.isArray(data.units)) {
      items.value = data.units.map(mapUnit)
    }
  }

  async function deleteUnit(id: number) {
  const index = items.value.findIndex(i => i.id === id)
  if (index !== -1) {
    items.value.splice(index, 1)
    // Add backend API call:
    const roomId = await ensureRoom()
    await fetch(`${apiBase()}/api/rooms/${roomId}/units/${id}`, { 
      method: 'DELETE',
      credentials: 'include' 
    })
  }
}

  // Adds a new storage unit to the canvas
  async function addUnit(type: StorageType, x: number, y: number, emojiOverride?: string) {
    const meta = META[type]
    const optimistic: StorageUnit = { id: idSeq++, type, x, y, w: meta.w, h: meta.h, rotation: 0, emoji: (emojiOverride ?? meta.emoji), name: (LABEL ? LABEL[type] : undefined), contents: [] }
    items.value.push(optimistic)
    try {
      const roomId = await ensureRoom()
      const res = await fetch(`${apiBase()}/api/rooms/${roomId}/units`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, x, y, w: optimistic.w, h: optimistic.h, rotation: optimistic.rotation, emoji: optimistic.emoji, name: optimistic.name })
      })
      const data = await res.json()
      if (data?.ok && data.unit) {
        // Replace optimistic with server unit
        const idx = items.value.findIndex(i => i.id === optimistic.id)
        if (idx !== -1) items.value[idx] = mapUnit({ ...data.unit, items: [] })
        return data.unit.id as number
      }
    } catch {}
    return optimistic.id
  }

  // Updates an existing storage unit with a partial patch
  async function updateUnit(id: number, patch: Partial<Omit<StorageUnit, 'id' | 'type' | 'emoji'>>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    Object.assign(it, patch)
    // Best-effort sync to backend
    try {
      await fetch(`${apiBase()}/api/units/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    } catch {}
  }

  // Updates only the position of a storage unit
  function updatePos(id: number, x: number, y: number) { return updateUnit(id, { x, y }) }

  // Removes a unit by id
  async function removeUnit(id: number) {
    items.value = items.value.filter(i => i.id !== id)
    try { await fetch(`${apiBase()}/api/units/${id}`, { method: 'DELETE', credentials: 'include' }) } catch {}
  }

  async function deleteUnit(id: number) {
  items.value = items.value.filter(i => i.id !== id)
  try { 
    await fetch(`${apiBase()}/api/units/${id}`, { 
      method: 'DELETE', 
      credentials: 'include' 
    }) 
  } catch {}
}
  // Clears all units
  async function clear() {
    const ids = items.value.map(i => i.id)
    items.value = []
    try { await Promise.all(ids.map(id => fetch(`${apiBase()}/api/units/${id}`, { method: 'DELETE', credentials: 'include' }))) } catch {}
  }

  // Replaces the contents array for a unit
  async function setContents(id: number, contents: StoredObject[]) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents = contents
    // Replace items on server: delete all then create anew
    try {
      const listRes = await fetch(`${apiBase()}/api/units/${id}/items`, { credentials: 'include' })
      const listData = await listRes.json()
      const existing: any[] = listData?.items || []
      await Promise.all(existing.map(itm => fetch(`${apiBase()}/api/items/${itm.id}`, { method: 'DELETE', credentials: 'include' })))
      await Promise.all(contents.map(c => fetch(`${apiBase()}/api/units/${id}/items`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) })))
    } catch {}
  }

  // Adds a single content item to a unit
  async function addContent(id: number, item?: Partial<StoredObject>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    const obj = { name: item?.name ?? 'Ese', quantity: item?.quantity ?? 1 }
    it.contents.push(obj)
    try { await fetch(`${apiBase()}/api/units/${id}/items`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }) } catch {}
  }

  // Removes a content item from a unit by index
  async function removeContent(id: number, index: number) {
    const it = items.value.find(i => i.id === id)
    if (!it || index < 0 || index >= it.contents.length) return
    // Try to delete corresponding server item by index order
    try {
      const listRes = await fetch(`${apiBase()}/api/units/${id}/items`, { credentials: 'include' })
      const listData = await listRes.json()
      const existing: any[] = listData?.items || []
      const target = existing[index]
      if (target) { await fetch(`${apiBase()}/api/items/${target.id}`, { method: 'DELETE', credentials: 'include' }) }
    } catch {}
    it.contents.splice(index, 1)
  }

  return { items, currentRoomId, ensureRoom, loadUnits, addUnit, updateUnit, updatePos, removeUnit, clear, setContents, addContent, removeContent, deleteUnit }
})
