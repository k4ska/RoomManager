<template>
  <div class="min-h-screen bg-gradient-to-b from-[#0b1120] to-[#1a2238] text-gray-100">
    <div class="max-w-6xl mx-auto py-8 px-6">
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold">Toa kujundaja</h1>
        <Toolbar />
      </header>

      <UCard class="bg-[#111827]/80 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-xl">
        <ClientOnly>
          <RoomCanvas />
          <template #fallback>
            <div class="p-12 text-center text-gray-500">Lõuend laadib…</div>
          </template>
        </ClientOnly>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import Toolbar from '~/components/Toolbar.vue'
import RoomCanvas from '~/components/RoomCanvas.vue'
import { onMounted, onBeforeUnmount } from 'vue'
import { useRoomShapeStore } from '~/stores/roomShape'

definePageMeta({ middleware: 'auth' })

const shape = useRoomShapeStore()
onMounted(() => { shape.loadFromServer().catch(() => {}) })
onBeforeUnmount(() => { shape.saveToServer().catch(() => {}) })
</script>
