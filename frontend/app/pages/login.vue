<script setup lang="ts">
import * as z from 'zod'
import { ref } from 'vue'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import { useAuthApi } from '~/composables/useAuth'

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>
const { login } = useAuthApi()

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const router = useRouter()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = null

  try {
    const res = await login(payload.data.email, payload.data.password)
    if (res?.ok) {
      await router.push('/')
      return
    }
    errorMessage.value = res?.message || res?.error || 'Login failed. Check your credentials.'
  } catch (err: any) {
    errorMessage.value = err?.message || String(err) || 'Login failed due to network error.'
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div class="flex flex-col items-center justify-center gap-8 p-10">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Login"
        icon="i-lucide-user"
        @submit="onSubmit"
      >
        <template #description>
          Don't have an account? <ULink to="/register" class="text-primary font-medium">Sign up</ULink>.
        </template>
        
        <template #validation>
          <UAlert v-if="errorMessage" color="error" icon="i-lucide-info" :title="errorMessage" />
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>

