<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)
const title = ref('')
const message = ref('')
let resolver: ((v: boolean) => void) | null = null

function open(opts: { title: string; message: string }) {
  title.value = opts.title
  message.value = opts.message
  visible.value = true
  return new Promise<boolean>(resolve => { resolver = resolve })
}

function confirm() {
  visible.value = false
  resolver?.(true)
}

function cancel() {
  visible.value = false
  resolver?.(false)
}

defineExpose({ open })
</script>

<template>
  <UModal v-model:open="visible" :title="title" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="message">{{ message }}</div>
    </template>
    <template #footer="{ close }">
      <UButton variant="outline" @click="cancel">Tühista</UButton>
      <UButton color="error" @click="confirm">Kustuta</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.message { margin: 6px 0 8px; color: var(--text); }
</style>
