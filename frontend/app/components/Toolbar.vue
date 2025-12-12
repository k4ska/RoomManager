<template>
  <div class="toolbar">
    <button class="btn" @click="newRoom">Uus ruum</button>
    
    <button class="btn" :class="{ active: store.addPointMode }" @click="toggleAdd">Lisa tipp</button>
    <button class="btn" :class="{ active: store.addWindowMode }" @click="toggleWindow">Lisa aken</button>
    <button class="btn" :class="{ active: store.addDoorMode }" @click="toggleDoor">Lisa uks</button>
    
    <button class="btn" :class="{ active: store.snapEnabled }" @click="toggleSnap">Snap on</button>
    <button class="btn" :class="{ active: store.showMetrics }" @click="toggleMetrics">Mõõdud</button>
    <button class="btn success" @click="save">Salvesta ruum</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'

const router = useRouter()
const store = useRoomShapeStore()
const storage = useStorageStore()

// Resets the room shape and clears storage
const newRoom = () => { store.resetShape(); storage.clear() }

const setMode = (mode: 'addPoint' | 'addWindow' | 'addDoor' | 'none') => {
  // Lülita KÕIK TÄPSELT VÄLJA
  store.addPointMode = false
  store.addWindowMode = false  
  store.addDoorMode = false
  
  // Lülita ainult VAJALIK SISSE
  if (mode === 'none') return  // KÕIK JÄEVAD VÄLJA ✅
  if (mode === 'addPoint') store.addPointMode = true
  else if (mode === 'addWindow') store.addWindowMode = true
  else if (mode === 'addDoor') store.addDoorMode = true
}

// Toggles grid snapping
const toggleSnap = () => store.toggleSnap()
// Toggles metrics display
const toggleMetrics = () => store.toggleShowMetrics()
// Navigates to the storage layout page
const save = async () => { try { await store.saveToServer() } catch {} ; router.push('/storage') }

const toggleAdd = () => setMode(store.addPointMode ? 'none' : 'addPoint')
const toggleWindow = () => setMode(store.addWindowMode ? 'none' : 'addWindow') 
const toggleDoor = () => setMode(store.addDoorMode ? 'none' : 'addDoor')

</script>

<style scoped>
.toolbar { 
  display: flex; 
  gap: 8px; 
}
.btn {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text);
  border: 1px solid #334155;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .15s ease, transform .1s ease;
}
.btn:hover { 
  background: rgba(148, 163, 184, 0.25); 
}
.btn:active { 
  transform: translateY(1px); 
}
.btn.success { 
  background: var(--accent); 
  color: #062217; 
  border-color: transparent; 
}
.btn.success:hover { 
  background: var(--accent-hover); 
}
.btn.active { 
  outline: 2px solid var(--accent); 
}
</style>
