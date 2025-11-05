<template>
  <div v-if="visible" class="backdrop" @click="cancel">
    <div class="modal" @click.stop>
      <h3>{{ title }}</h3>
      <p class="message">{{ message }}</p>
      <div class="actions">
        <button class="btn" @click="cancel">Tühista</button>
        <button class="btn danger" @click="confirm">Kustuta</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const visible = ref(false)
const title = ref('')
const message = ref('')
let resolver: ((value: boolean) => void) | null = null

function open(opts: { title: string; message: string }) {
  title.value = opts.title
  message.value = opts.message
  visible.value = true

  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
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

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: grid;
  place-items: center;
}
.modal {
  width: 480px;
  max-width: 90vw;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 16px;
  color: var(--text);
}
.message {
  margin: 8px 0 16px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  background: rgba(148,163,184,0.15);
  color: var(--text);
  border: 1px solid #334155;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 700;
}
.btn:hover {
  background: rgba(148,163,184,0.25);
}
.btn.danger {
  background: rgba(244,63,94,0.15);
  border-color: #7f1d1d;
}
.btn.danger:hover {
  background: rgba(244,63,94,0.25);
}
</style>
