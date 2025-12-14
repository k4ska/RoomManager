<template>
  <div class="rooms">
    <header class="head">
      <div>
        <h1>Minu toad</h1>
        <p class="muted">Vaata olemasolevaid tube ja lisa vajadusel uus.</p>
      </div>
      <button class="btn" @click="openCreateModal">Loo uus ruum</button>
    </header>

    <section class="list">
      <div v-if="loading" class="info">Laadin tube...</div>
      <div v-else-if="error" class="info error">{{ error }}</div>
      <div v-else-if="rooms.length === 0" class="info">Ühtegi tuba pole. Lisa esimene!</div>
      <article v-for="room in rooms" :key="room.id" class="card">
        <div class="room-main" @click="openRoom(room.id)">
          <div class="name">{{ room.name }}</div>
        </div>
        <div class="room-actions">
          <button class="icon" title="Muuda nime" @click.stop="editRoom(room)">✏️</button>
          <button class="icon danger" title="Kustuta tuba" @click.stop="removeRoom(room)">🗑️</button>
        </div>
      </article>
    </section>

    <UModal v-model:open="editOpen" title="Muuda toa nime" :ui="{ footer: 'justify-end' }">
      <template #body>
        <UInput v-model="editName" label="Uus nimi" placeholder="Toa nimi" />
      </template>
      <template #footer="{ close }">
        <UButton variant="ghost" @click="closeModals(); close()">Tühista</UButton>
        <UButton color="primary" @click="confirmEdit">Salvesta</UButton>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen" title="Kustuta tuba?" :ui="{ footer: 'justify-end' }">
      <template #body>
        <p>Seda toimingut ei saa tagasi võtta. Kustuta kogu sisu koos toaga?</p>
      </template>
      <template #footer="{ close }">
        <UButton variant="ghost" @click="closeModals(); close()">Tühista</UButton>
        <UButton color="error" @click="confirmDelete">Kustuta</UButton>
      </template>
    </UModal>

    <UModal v-model:open="createOpen" title="Loo uus tuba" :ui="{ footer: 'justify-end' }">
      <template #body>
        <UInput v-model="createName" label="Toa nimi" placeholder="Nt Kontor" />
      </template>
      <template #footer="{ close }">
        <UButton variant="ghost" @click="closeCreate(); close()">Tühista</UButton>
        <UButton color="primary" :loading="loading" @click="confirmCreate">Salvesta</UButton>
      </template>
    </UModal>
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
const editOpen = ref(false)
const deleteOpen = ref(false)
const createOpen = ref(false)
const targetRoom = ref<{ id: number; name: string } | null>(null)
const editName = ref('')
const createName = ref('')

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
  openCreateModal()
}

function openCreateModal() {
  createName.value = ''
  createOpen.value = true
}

function closeCreate() {
  createOpen.value = false
  createName.value = ''
}

async function confirmCreate() {
  const name = createName.value.trim()
  if (!name) { closeCreate(); return }
  loading.value = true
  error.value = ''
  try {
    const id = await store.createRoom(name)
    await store.fetchRooms()
    if (id) {
      store.setCurrentRoom(id)
      closeCreate()
      router.push('/editor')
      return
    }
    error.value = 'Uue ruumi loomine ebaõnnestus.'
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

function editRoom(room: { id: number; name: string }) {
  targetRoom.value = room
  editName.value = room.name
  editOpen.value = true
}

function removeRoom(room: { id: number; name: string }) {
  targetRoom.value = room
  deleteOpen.value = true
}

async function confirmEdit() {
  if (!targetRoom.value) { editOpen.value = false; return }
  if (!editName.value.trim()) { editOpen.value = false; return }
  await store.updateRoomName(targetRoom.value.id, editName.value)
  await store.fetchRooms()
  closeModals()
}

async function confirmDelete() {
  if (!targetRoom.value) { deleteOpen.value = false; return }
  await store.deleteRoom(targetRoom.value.id)
  await store.fetchRooms()
  closeModals()
}

function closeModals() {
  editOpen.value = false
  deleteOpen.value = false
  targetRoom.value = null
  editName.value = ''
}

onMounted(fetchRooms)
onMounted(() => { store.setCurrentRoom(null) })
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
  transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
}
.name { font-weight: 800; }
.card:hover {
  border-color: var(--accent);
  background: rgba(16,185,129,0.12);
  transform: translateY(-2px) scale(1.01);
}
.room-actions {
  display: flex;
  gap: 6px;
}
.icon {
  border: 1px solid #334155;
  background: rgba(255,255,255,0.02);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.icon:hover { background: rgba(148,163,184,0.12); border-color: rgba(148,163,184,0.35); }
.icon.danger { border-color: #7f1d1d; }
.icon.danger:hover { background: rgba(244,63,94,0.15); border-color: #ef4444; }
.info {
  border: 1px dashed #334155;
  border-radius: 12px;
  padding: 12px;
  color: var(--muted);
}
.info.error { color: #fca5a5; border-color: #7f1d1d; }
</style>
