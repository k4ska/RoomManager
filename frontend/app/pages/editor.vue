<template>
  <div class="min-h-screen bg-gradient-to-b from-[#0b1120] to-[#1a2238] text-gray-100 flex flex-col">
    <div class="max-w-[90rem] mx-auto w-full py-8 px-6 flex-1 flex gap-6">
      
      <!-- Sidebar -->
      <div class="w-80 flex flex-col gap-4 shrink-0">
         <header class="flex items-center justify-between mb-2">
            <h1 class="text-2xl font-semibold">Toa kujundaja</h1>
         </header>
         
         <!-- Search -->
         <input 
           v-model="searchQuery" 
           placeholder="Otsi eset..." 
           class="bg-[#1f2937] border border-slate-700 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-500"
         />

         <!-- List -->
         <div class="flex-1 overflow-y-auto bg-[#111827]/80 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 custom-scrollbar">
            <div v-for="unit in filteredUnits" :key="unit.id" class="mb-4">
               <div class="font-bold text-yellow-500 mb-2 flex items-center gap-2 sticky top-0 bg-[#111827]/90 p-1 rounded z-10">
                  <span class="text-xl">{{ unit.emoji }}</span>
                  <span>{{ unit.name }}</span>
               </div>
               <div class="pl-2 space-y-2 border-l-2 border-slate-800 ml-2">
                  <div v-for="item in unit.contents" :key="item.id" 
                       class="p-3 rounded bg-slate-800/40 border border-slate-700/50 text-sm hover:bg-slate-800/60 transition-all"
                       :class="{ 'border-yellow-500 ring-1 ring-yellow-500/50': item.id === storage.highlightedItemId }"
                  >
                     <div class="flex justify-between items-start mb-2">
                        <span class="font-medium" :class="{ 'text-red-400': item.isTaken, 'text-green-400': !item.isTaken }">
                           {{ item.isTaken ? '🔴' : '🟢' }} {{ item.name }}
                        </span>
                        <span class="text-xs font-mono bg-slate-900 px-1.5 py-0.5 rounded text-gray-400">x{{ item.quantity }}</span>
                     </div>
                     <div class="flex gap-2">
                        <button 
                           @click="storage.toggleItemStatus(item.id, item.isTaken)"
                           class="flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors"
                           :class="item.isTaken ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'"
                        >
                           {{ item.isTaken ? 'Pane tagasi' : 'Võta' }}
                        </button>
                        <button 
                           @click="openEditPopup(item)"
                           class="px-3 py-1.5 text-xs font-medium rounded bg-blue-900/30 hover:bg-blue-900/50 transition-colors text-blue-300"
                        >
                           Muuda
                        </button>
                     </div>
                  </div>
                  <div v-if="unit.contents.length === 0" class="text-xs text-gray-600 italic pl-2">
                    Tühi
                  </div>
               </div>
            </div>
         </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col min-w-0">
          <header class="flex items-center justify-end mb-6 h-10">
            <Toolbar />
          </header>

          <UCard class="bg-[#111827]/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-xl flex-1 overflow-hidden relative">
            <ClientOnly>
              <RoomCanvas />
              <template #fallback>
                <div class="absolute inset-0 flex items-center justify-center text-gray-500">Lõuend laeb...</div>
              </template>
            </ClientOnly>
          </UCard>
      </div>
    </div>
    
    <!-- Edit Popup -->
    <div v-if="editingItem" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" @click.self="editingItem = null">
       <div class="bg-[#1f2937] p-6 rounded-xl w-96 border border-slate-600 shadow-2xl transform transition-all">
          <h3 class="text-xl font-bold mb-6 text-white">Muuda eset</h3>
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Nimi</label>
              <input v-model="editForm.name" class="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            </div>
            
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Kogus</label>
              <input v-model.number="editForm.quantity" type="number" min="1" class="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            </div>
            
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Asukoht</label>
              <select v-model="editForm.furnitureId" class="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none">
                 <option v-for="u in storage.items" :key="u.id" :value="u.id">
                    {{ u.emoji }} {{ u.name }}
                 </option>
              </select>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 mt-8">
             <button @click="editingItem = null" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-gray-200 transition-colors font-medium text-sm">Loobu</button>
             <button @click="saveEdit" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all font-medium text-sm">Salvesta</button>
          </div>
       </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import Toolbar from '~/components/Toolbar.vue'
import RoomCanvas from '~/components/RoomCanvas.vue'
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'
import { useStorageStore } from '~/stores/storageStore'

const shape = useRoomShapeStore()
const storage = useStorageStore()
const searchQuery = ref('')
const editingItem = ref<any>(null)
const editForm = ref({ name: '', quantity: 1, furnitureId: 0 })

onMounted(() => { shape.loadFromServer().catch(() => {}) })
onBeforeUnmount(() => { shape.saveToServer().catch(() => {}) })

const filteredUnits = computed(() => {
   // Show all units, highlighting is handled by storage.highlightedItemId
   return storage.items
})

watch(searchQuery, (q) => {
   if (!q) {
      storage.highlightedItemId = null
      return
   }
   const lower = q.toLowerCase()
   for (const u of storage.items) {
      for (const i of u.contents) {
         if (i.name.toLowerCase().includes(lower)) {
            storage.highlightedItemId = i.id
            return
         }
      }
   }
   storage.highlightedItemId = null
})

function openEditPopup(item: any) {
   editingItem.value = item
   const parent = storage.items.find(u => u.contents.some(c => c.id === item.id))
   editForm.value = {
      name: item.name,
      quantity: item.quantity,
      furnitureId: parent ? parent.id : 0
   }
}

async function saveEdit() {
   if (!editingItem.value) return
   await storage.updateItem(editingItem.value.id, {
      name: editForm.value.name,
      quantity: editForm.value.quantity,
      furnitureId: editForm.value.furnitureId
   })
   editingItem.value = null
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 1);
}
</style>