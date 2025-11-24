<template>
  <header v-if="!isExcluded" class="header">
    <div class="container">
      <div class="brand" @click.prevent="router.push('/')">
        <div class="logo">RM</div>
        <div class="titles">
          <div class="name">Ruumihaldur</div>
        </div>
      </div>
      <div class="actions">
        <button class="pill ghost" @click.prevent="router.push('/')">Avaleht</button>
        <button v-if="user" class="pill accent" @click="onLogout">Logi välja</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
const route = useRoute()
const router = useRouter()

// hide on these paths
const excludedPaths = ['/login', '/register']
const isExcluded = computed(() => excludedPaths.includes(route.path))

// access shared user state
const user = useState<any>('user')

async function onLogout() {
  try {
    const { useAuthApi } = await import('~/composables/useAuth')
    const { logout } = useAuthApi()
    await logout()
  } finally {
    // Nulli kasutaja olek igaks juhuks ja liigu /login
    const userState = useState<any>('user', () => null)
    userState.value = null
    router.push('/login')
  }
}
</script>

<style scoped>
.header {
  background: linear-gradient(90deg, rgba(5, 9, 18, 0.9), rgba(10, 16, 28, 0.85));
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.container {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.brand {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.logo {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.16);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: var(--accent);
  display: grid;
  place-items: center;
  font-weight: 800;
  letter-spacing: 0.4px;
}
.titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.name {
  font-weight: 800;
  font-size: 25px;
}
.tagline {
  color: var(--muted);
  font-size: 12px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pill {
  border: 1px solid rgba(148,163,184,0.2);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255,255,255,0.02);
  color: var(--text);
  cursor: pointer;
  font-weight: 700;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}
.pill:hover { border-color: rgba(148,163,184,0.35); background: rgba(148,163,184,0.06); }
.pill:active { transform: translateY(1px); }
.pill.accent {
  background: var(--accent);
  color: #052012;
  border-color: var(--accent);
}
.pill.accent:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.pill.ghost { background: rgba(255,255,255,0.02); }
</style>
