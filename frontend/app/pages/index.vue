<template>
  <main class="landing">
    <div class="page-header">
      <div class="title">
        <h1>Ruumihaldur</h1>
        <p>Kujunda ja halda oma tuba digitaalselt.</p>
      </div>
    </div>

    <div class="center">
      <div class="cta-group">
        <button class="cta-btn" @click="openCreate">Loo uus ruum</button>
        <button class="cta-btn" @click="goView">Vaata oma tube</button>
      </div>
    </div>

    <UModal v-model:open="createOpen" title="Loo uus tuba" :ui="{ footer: 'justify-end' }">
      <template #body>
        <UInput v-model="createName" label="Toa nimi" placeholder="Nt Kontor" />
      </template>
      <template #footer="{ close }">
        <UButton variant="ghost" @click="closeCreate(); close()">Tühista</UButton>
        <UButton color="primary" :loading="creating" @click="confirmCreate">Salvesta</UButton>
      </template>
    </UModal>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStorageStore } from '~/stores/storageStore'

const goView = () => navigateTo('/rooms')
const store = useStorageStore()
const router = useRouter()
const createOpen = ref(false)
const createName = ref('')
const creating = ref(false)

function openCreate() {
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
  creating.value = true
  try {
    const id = await store.createRoom(name)
    await store.fetchRooms()
    if (id) {
      store.setCurrentRoom(id)
      closeCreate()
      router.push('/editor')
      return
    }
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 24px 24px 24px;
}

.page-header {
  display: flex;
  justify-content: center; /* center horizontally */
  padding-top: 24px;
}

.title {
  text-align: center; /* center text inside the title block */
  max-width: 500px;   /* keep paragraph from getting too wide */
  width: min(92%, 500px);
  margin: 0 auto;     /* center the block itself */
}

.center {
  flex: 1; /* take remaining height */
  display: flex;
  align-items: center; /* center vertically */
  justify-content: center; /* center horizontally */
  text-align: center;
}

h1 {
  margin: 0 0 12px 0;
  font-size: 3rem; /* ~48px */
  font-weight: 800;
  letter-spacing: -0.02em;
}

p {
  color: var(--muted);
  font-size: 1.125rem; /* ~18px */
}

.cta-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-top: -200px;
  width: min(320px, 92%); /* control the group width so buttons can be full width */
}

.cta-btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 100%; /* fill the cta-group width so all buttons match */
  padding: 20px 28px;
  border-radius: 14px;
  background: var(--accent);
  color: #062217;
  font-weight: 700;
  font-size: 1.4rem;
  text-decoration: none;
  box-shadow: 0 10px 18px rgba(16, 185, 129, 0.25);
  transform: translateZ(0);
  transition: transform 0.15s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  box-sizing: border-box;
}

.cta-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 12px 22px rgba(16, 185, 129, 0.35);
  transform: scale(1.03);
}

.cta-btn:active {
  transform: scale(0.99);
}
</style>
