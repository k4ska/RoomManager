<template>
  <div class="storage-wrap">
    <header class="head">
      <h1>Ladustuse paigutus</h1>
      <div class="actions">
        <NuxtLink class="btn" to="/editor">Tagasi</NuxtLink>
        <button class="btn warn" :disabled="!selectedId" @click="removeSelected">Kustuta valitu</button>
        <button class="btn warn" :disabled="!hasItems" @click="removeAll">Kustuta kõik</button>
        <button class="btn success" @click="goView">Salvesta → Vaade</button>
      </div>
    </header>

    <section class="content">
      <StorageSelector />
      <div class="canvas-card">
        <div class="hint">Lohista „Kast”, „Kapp” või „Riiul” lõuendile ja liiguta neid.</div>
        <ClientOnly>
          <StorageCanvas />
        </ClientOnly>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import StorageSelector from '~/components/StorageSelector.vue'
import StorageCanvas from '~/components/StorageCanvas.vue'
import { useRouter } from 'vue-router'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useStorageStore } from '~/stores/storageStore'

const router = useRouter()
function goView() { router.push('/view') }

const store = useStorageStore()
const hasItems = computed(() => store.items.length > 0)
const selectedId = ref<number | null>(null)
function setSelected(id: number | null){ selectedId.value = id }
onMounted(() => { (window as any).__rm_setSelected = setSelected })
onBeforeUnmount(() => { delete (window as any).__rm_setSelected })
function removeSelected(){ if(selectedId.value!=null){ store.removeUnit(selectedId.value); selectedId.value=null } }
function removeAll(){
  if(!hasItems.value) return
  const ok = window.confirm('Kas kustutada kõik üksused? Seda toimingut ei saa tagasi võtta.')
  if(ok){ store.clear(); selectedId.value=null }
}
</script>

<style scoped>
.storage-wrap {
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
.head { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  margin-bottom: 14px; 
}
.content { 
  display: grid; 
  grid-template-columns: 320px 1fr; 
  gap: 32px; 
  align-items: start; 
}
.content :deep(.sidebar) { 
  margin-right: 4px; 
  box-sizing: border-box; 
}
.canvas-card { 
  background: rgba(17,24,39,0.8);
  border: 1px solid #334155; 
  border-radius: 16px; 
  padding: 12px; 
  overflow: hidden; 
}
.hint { 
  color: #9ca3af; 
  margin: 6px; 
  font-size: .95rem; 
}
.actions { 
  display: flex; 
  gap: 8px; 
}
.btn { 
  background: rgba(148,163,184,0.15); 
  color: var(--text); border: 1px solid #334155; 
  padding: 8px 12px; 
  border-radius: 10px; 
  font-weight: 700; 
  text-decoration: none; 
}
.btn:hover { 
  background: rgba(148,163,184,0.25); 
}
.btn.warn { 
  background: rgba(244,63,94,0.15); 
  border-color: #7f1d1d; 
}
.btn.warn:hover { 
  background: rgba(244,63,94,0.25); 
}
.btn.success { 
  background: var(--accent); 
  color: #062217; 
  border-color: transparent; 
}
.btn.success:hover { 
  background: var(--accent-hover); 
}
</style>
