import { defineStore } from 'pinia'
import { ref } from 'vue'

export type StorageType = 'box' | 'cabinet' | 'shelf' | 'table' | 'drawer' | 'locker' | 'workbench'
export type StorageKind = StorageType | 'custom' | string

export interface StoredObject { 
  name: string; 
  quantity: number; 
  inUse?: number 
}

export interface StorageUnit {
  id: number
  type: StorageKind
  x: number 
  y: number 
  w: number
  h: number
  rotation: number 
  emoji: string
  name?: string
  contents: StoredObject[]
}

export interface RoomSummary {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
}

let idSeq = 1

export const UNIT_SIZE = 56

const LABEL: Record<StorageType, string> = {
  box: 'Kast',
  cabinet: 'Kapp',
  shelf: 'Riiul',
  table: 'Laud',
  drawer: 'Sahtel',
  locker: 'Kapp (lukuga)',
  workbench: 'Töölaud'
}

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
  const rooms = ref<RoomSummary[]>([])

  const ROOM_KEY = 'rm_current_room'

  function apiBase() {
    try {
      const runtime = useRuntimeConfig()
      return (runtime as any)?.public?.apiBase || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
    } catch {
      return process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000'
    }
  }

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
      contents: (u.items || []).map((it: any) => ({ 
        name: it.name, 
        quantity: it.quantity, 
        inUse: 0 
      }))
    }
  }

  function loadStoredRoomId(): number | null {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(ROOM_KEY)
    const parsed = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(parsed) ? parsed : null
  }

  function persistRoomId(id: number | null) {
    if (typeof localStorage === 'undefined') return
    if (id == null) localStorage.removeItem(ROOM_KEY)
    else localStorage.setItem(ROOM_KEY, String(id))
  }

  // Veendub, et kasutajal on tuba; vajadusel loob uue
  async function ensureRoom(): Promise<number> {
    if (currentRoomId.value) return currentRoomId.value
    await fetchRooms()
    const stored = loadStoredRoomId()
    if (stored && rooms.value.some(r => r.id === stored)) {
      currentRoomId.value = stored
      return stored
    }
    if (rooms.value.length) {
      currentRoomId.value = rooms.value[0].id
      persistRoomId(currentRoomId.value)
      return currentRoomId.value
    }
    const created = await createRoom('Minu tuba')
    return created
  }

  async function fetchRooms() {
    try {
      const res = await fetch(`${apiBase()}/api/rooms`, { credentials: 'include' })
      const data = await res.json()
      if (data?.ok && Array.isArray(data.rooms)) rooms.value = data.rooms
    } catch {}
  }

  async function createRoom(name?: string): Promise<number> {
    const res = await fetch(`${apiBase()}/api/rooms`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: (name || 'Uus tuba').slice(0, 60) })
    })
    const data = await res.json()
    const id = data?.room?.id as number | undefined
    if (data?.ok && id) {
      await fetchRooms()
      currentRoomId.value = id
      persistRoomId(id)
      items.value = []
      return id
    }
    return await ensureRoom()
  }

  function setCurrentRoom(id: number | null) {
    currentRoomId.value = id
    persistRoomId(id)
  }

  async function updateRoomName(id: number, name: string) {
    try {
      const trimmed = (name ?? '').toString().trim().slice(0, 60)
      if (!trimmed) return false
      const res = await fetch(`${apiBase()}/api/rooms/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      const data = await res.json()
      if (data?.ok) {
        await fetchRooms()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function deleteRoom(id: number) {
    try {
      const res = await fetch(`${apiBase()}/api/rooms/${id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (data?.ok) {
        await fetchRooms()
        if (currentRoomId.value === id) {
          const stored = loadStoredRoomId()
          if (stored === id) persistRoomId(null)
          currentRoomId.value = rooms.value[0]?.id ?? null
          items.value = []
          if (currentRoomId.value) await loadUnits()
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function loadUnits() {
    const roomId = await ensureRoom()
    const res = await fetch(`${apiBase()}/api/rooms/${roomId}/units`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && Array.isArray(data.units)) {
      items.value = data.units.map(mapUnit)
    }
  }

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
      name: nameOverride ?? (LABEL[type as StorageType]),
      contents: []
    }
    items.value.push(optimistic)
    return optimistic.id
  }

  async function updateUnit(id: number, patch: Partial<Omit<StorageUnit, 'id' | 'type' | 'emoji'>>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    Object.assign(it, patch)
  }

  function updatePos(id: number, x: number, y: number) { 
    return updateUnit(id, { x: Math.round(x), y: Math.round(y) }) 
  }

  async function removeUnit(id: number) {
    items.value = items.value.filter(i => i.id !== id)
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
    // Defer server sync to saveToServer
  }

  async function setContents(id: number, contents: StoredObject[]) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    it.contents = contents
  }

  async function addContent(id: number, item?: Partial<StoredObject>) {
    const it = items.value.find(i => i.id === id)
    if (!it) return
    const obj = { name: item?.name ?? 'Ese', quantity: item?.quantity ?? 1 }
    it.contents.push(obj)
  }

  async function removeContent(id: number, index: number) {
    const it = items.value.find(i => i.id === id)
    if (!it || index < 0 || index >= it.contents.length) return
    it.contents.splice(index, 1)
  }

  function getUnitInUseTotal(unitId: number): number {
    const unit = items.value.find(i => i.id === unitId)
    return unit?.contents.reduce((sum, item) => sum + (item.inUse || 0), 0) || 0
  }

  async function updateItemUsage(unitId: number, itemIndex: number, inUseCount: number) {
    const unit = items.value.find(i => i.id === unitId)
    if (!unit || itemIndex >= unit.contents.length) return
    
    const item = unit.contents[itemIndex]
    item.inUse = Math.max(0, Math.min(inUseCount, item.quantity))
  }

  const highlightedInUse = ref<{unitId: number, itemIndex: number} | null>(null)

  async function saveToServer(): Promise<boolean> {
    try {
      const roomId = await ensureRoom()
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
      const res = await fetch(`${apiBase()}/api/rooms/${roomId}/layout`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const text = await res.text()
      if (!res.ok) {
        console.error('saveToServer error', res.status, text)
        return false
      }
      try { 
        const data = JSON.parse(text); 
        if (!(data && data.ok)) return false 
      } catch (e) { }
      return true
    } catch (e) {
      console.error('saveToServer failed', e)
      return false
    }
  }

  return {
    items, currentRoomId, rooms,
    ensureRoom, loadUnits, fetchRooms, createRoom, setCurrentRoom, updateRoomName, deleteRoom,
    addUnit, updateUnit,
    updatePos, removeUnit,
    clear, setContents,
    addContent, removeContent,
    saveToServer, deleteUnit,
    getUnitInUseTotal, updateItemUsage,
    highlightedInUse
  }
})
