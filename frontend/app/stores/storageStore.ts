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

  const runtime = (useRuntimeConfig?.() as any)
  const publicCfg = runtime.public
  const publicApiBase = publicCfg.apiBase

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

  async function ensureRoom(): Promise<number> {
    if (currentRoomId.value) return currentRoomId.value
    const res = await fetch(`${publicApiBase}/api/rooms`, { credentials: 'include' })
    const data = await res.json()
    if (data?.ok && data.rooms?.length) {
      currentRoomId.value = data.rooms[0].id
      return currentRoomId.value
    }
    const create = await fetch(`${publicApiBase}/api/rooms`, {
      method: 'POST', 
      credentials: 'include', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ name: 'Minu tuba' })
    })
    const payload = await create.json()
    currentRoomId.value = payload?.room?.id ?? null
    return currentRoomId.value as number
  }

  async function loadUnits() {
    const roomId = await ensureRoom()
    const res = await fetch(`${publicApiBase}/api/rooms/${roomId}/units`, { credentials: 'include' })
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
      await fetch(`${publicApiBase}/api/units/${id}`, { 
        method: 'DELETE', 
        credentials: 'include' 
      }) 
    } catch {}
  }

  async function clear() {
    items.value = []
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
      const payload = { 
        units: items.value.map(u => ({
          type: u.type,
          x: Math.round(u.x),
          y: Math.round(u.y),
          w: Math.round(u.w),
          h: Math.round(u.h),
          rotation: Math.round(u.rotation || 0),
          emoji: u.emoji,
          name: u.name,
          contents: (u.contents || []).map(c => ({ 
            name: c.name, 
            quantity: Math.max(1, Math.round(c.quantity || 1)),
            inUse: c.inUse || 0
          }))
        })) 
      }
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
    items, currentRoomId,
    ensureRoom, loadUnits,
    addUnit, updateUnit,
    updatePos, removeUnit,
    clear, setContents,
    addContent, removeContent,
    saveToServer, deleteUnit,
    getUnitInUseTotal, updateItemUsage,
    highlightedInUse
  }
})
