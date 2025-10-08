<template>
    <div class="flex-col items-center justify-center min-h-screen">
    <UContainer class="py-12 text-center">
        
        <h1 class="text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl mb-8">
        Room Manager
        </h1>

        <UButton 
        size="xl" 
        icon="i-heroicons-sparkles" 
        label="Loo Uus Ruum"
        @click="navigateTo('/create-room')" 
        />
        
    </UContainer>
    </div>
</template>

<script setup>
// const navigate = () => {
//   navigateTo('/create-room');
// }
</script>

<style scoped>
</style>