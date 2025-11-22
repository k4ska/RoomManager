<template>
  <div class="toolbar">
    <button class="btn" @click="newRoom">Uus ruum</button>
    <button class="btn" :class="{ active: store.addPointMode }" @click="toggleAdd">Lisa tipp</button>
    <button class="btn" :class="{ active: store.snapEnabled }" @click="toggleSnap">Snap on</button>
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
// Toggles point-adding mode for the room shape
const toggleAdd = () => store.toggleAddPointMode()
// Toggles grid snapping
const toggleSnap = () => store.toggleSnap()
// Navigates to the storage layout page
const save = async () => { try { await store.saveToServer() } catch {} ; router.push('/storage') }
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
