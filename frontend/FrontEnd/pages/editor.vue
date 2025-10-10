<template>
  <div class="editor-wrap">
    <header class="editor-header">
      <h1>Toa kujundaja</h1>
      <Toolbar />
    </header>

    <section class="editor-card">
      <div class="hint">Nipp: lülita „Lisa tipp” ja klõpsa polügooni äärel, et lisada uus tipp. Lohista tippe kuju muutmiseks.</div>
      <ClientOnly>
        <RoomCanvas />
        <template #fallback>
          <div class="loading">Lõuend laeb…</div>
        </template>
      </ClientOnly>
    </section>

    <div v-if="store.showShapeModal" class="modal-backdrop" @click.self="store.closeShapeModal()">
      <div class="modal">
        <h2>Vali kuju</h2>
        <div class="choices">
          <button class="choice" @click="choose('rectangle')">Ristkülik</button>
          <button class="choice" @click="choose('square')">Ruut</button>
          <button class="choice" @click="choose('triangle')">Kolmnurk</button>
          <button class="choice" @click="choose('polygon')">Polügoon</button>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="store.closeShapeModal()">Sulge</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Toolbar from '~/components/Toolbar.vue'
import RoomCanvas from '~/components/RoomCanvas.vue'
import { useRoomShapeStore, type ShapeType } from '~/stores/roomShape'
const store = useRoomShapeStore()
function choose(type: ShapeType) {
  store.setShape(type)
  store.closeShapeModal()
}
</script>

<style scoped>
.editor-wrap {
  min-height: 100vh;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.editor-header h1 {
  font-size: 1.5rem;
  margin: 0;
}

.editor-card {
  background: rgba(17, 24, 39, 0.8);
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  padding: 16px;
}

.loading {
  padding: 48px;
  text-align: center;
  color: #9ca3af;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 20px;
  width: 420px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.45);
}
.modal h2 { margin: 0 0 12px 0; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.choice {
  background: rgba(148,163,184,0.15);
  border: 1px solid #334155;
  color: var(--text);
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.choice:hover { background: rgba(148,163,184,0.25); }
.modal-actions { margin-top: 12px; text-align: right; }
.btn {
  background: rgba(148,163,184,0.15);
  border: 1px solid #334155;
  color: var(--text);
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover { background: rgba(148,163,184,0.25); }
</style>
