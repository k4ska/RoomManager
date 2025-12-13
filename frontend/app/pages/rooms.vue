<template>
  <div class="rooms">
    <header class="head">
      <div>
        <h1>Minu toad</h1>
        <p class="muted">Vaata olemasolevaid tube ja lisa vajadusel uus.</p>
      </div>
      <button class="btn" @click="createRoom">Loo uus ruum</button>
    </header>

    <section class="list">
      <div v-if="loading" class="info">Laadin tube...</div>
      <div v-else-if="error" class="info error">{{ error }}</div>
      <div v-else-if="rooms.length === 0" class="info">Ühtegi tuba pole. Lisa esimene!</div>
      <article v-for="room in rooms" :key="room.id" class="card" @click="openRoom(room.id)">
        <div class="name">{{ room.name }}</div>
        <div class="meta">ID {{ room.id }}</div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStorageStore } from '~/stores/storageStore'

const store = useStorageStore()
const router = useRouter()
const loading = ref(false)
const error = ref('')

const rooms = computed(() => store.rooms)

async function fetchRooms() {
  loading.value = true
  error.value = ''
  try {
    await store.fetchRooms()
  } catch {
    error.value = 'Tube ei õnnestunud laadida.'
  } finally {
    loading.value = false
  }
}

async function createRoom() {
  loading.value = true
  error.value = ''
  try {
    const id = await store.createRoom('Uus tuba')
    await store.fetchRooms()
    if (id) {
      store.setCurrentRoom(id)
      router.push('/editor')
    }
  } catch {
    error.value = 'Uue ruumi loomine ebaõnnestus.'
  } finally {
    loading.value = false
  }
}

function openRoom(id: number) {
  store.setCurrentRoom(id)
  router.push('/view')
}

onMounted(fetchRooms)
</script>

<style scoped>
.rooms {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.muted { margin: 4px 0 0 0; color: var(--muted); }
.btn {
  background: var(--accent);
  color: #052012;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}
.btn:hover { background: var(--accent-hover); }
.list { display: grid; gap: 10px; }
.card {
  border: 1px solid #1f2937;
  background: rgba(17,24,39,0.7);
  border-radius: 12px;
  padding: 12px;
}
.name { font-weight: 800; }
.meta { color: var(--muted); font-size: 13px; }
.info {
  border: 1px dashed #334155;
  border-radius: 12px;
  padding: 12px;
  color: var(--muted);
}
.info.error { color: #fca5a5; border-color: #7f1d1d; }
</style>
