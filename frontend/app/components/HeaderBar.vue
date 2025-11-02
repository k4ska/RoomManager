<template>
  <header v-if="!isExcluded" class="header">
    <div class="container">
      <div class="title">Ruumihaldur</div>
      <div class="actions">
        <button v-if="user" class="btn-logout" @click="onLogout">Logi välja</button>
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
  } catch (e) {
    // ignore errors but continue to navigate
  }
  // navigate to login page after logout
  router.push('/login')
}
</script>

<style scoped>
.header {
  background: rgba(6, 8, 15, 0.6);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title { font-weight: 700; }
.btn-logout {
  background: transparent;
  color: var(--text);
  border: 1px solid rgba(148,163,184,0.15);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-logout:hover { background: rgba(148,163,184,0.06); }
</style>
