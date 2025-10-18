<template>
  <main class="auth-wrap">
    <form class="card" @submit.prevent="onSubmit">
      <h1>Logi sisse</h1>
      <label class="lbl">Email</label>
      <input class="inp" type="email" v-model="email" required />
      <label class="lbl">Parool</label>
      <input class="inp" type="password" v-model="password" required />
      <div class="error" v-if="error">{{ error }}</div>
      <button class="btn" :disabled="loading">{{ loading ? 'Sisselogimine…' : 'Logi sisse' }}</button>
      <p class="hint">Pole kasutajat? <NuxtLink to="/register">Loo konto</NuxtLink></p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthApi } from '~/composables/useAuth'

const router = useRouter()
const { login } = useAuthApi()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// Submits login form and redirects on success
async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    const res = await login(email.value, password.value)
    if (!res?.ok) {
      error.value = res?.error || 'Sisselogimine ebaõnnestus'
      return
    }
    router.push('/storage')
  } catch (e) {
    error.value = 'Võrguviga'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.card { width: 420px; max-width: 95vw; background: rgba(17,24,39,0.85); border: 1px solid #334155; border-radius: 16px; padding: 18px; }
h1 { margin: 0 0 10px 0; font-size: 1.4rem; }
.lbl { display: block; margin: 10px 0 6px; font-size: .95rem; color: #cbd5e1; }
.inp { width: 100%; box-sizing: border-box; background: rgba(148,163,184,0.12); border: 1px solid #334155; border-radius: 10px; padding: 9px 10px; color: var(--text); }
.btn { margin-top: 14px; width: 100%; background: var(--accent); color: #062217; border: none; padding: 10px 12px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.hint { margin-top: 10px; color: #9ca3af; font-size: .95rem; }
.error { color: #f87171; font-size: .95rem; margin-top: 8px; }
</style>

