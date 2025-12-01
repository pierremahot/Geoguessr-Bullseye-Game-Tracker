<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { User } from 'lucide-vue-next';

const route = useRoute();
const playerId = route.params.id;
const loading = ref(true);
const error = ref(null);
const stats = ref(null);

onMounted(async () => {
  // TODO: Fetch player stats from backend
  // For now, just show the ID
  loading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center gap-4">
      <div class="p-3 bg-blue-500/20 rounded-full">
        <User class="w-8 h-8 text-blue-400" />
      </div>
      <div>
        <h2 class="text-3xl font-bold text-white">Player Stats</h2>
        <p class="text-gray-400 font-mono text-sm">{{ playerId }}</p>
      </div>
    </header>

    <div class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl">
      <p class="text-gray-300">Detailed stats for this player coming soon...</p>
    </div>
  </div>
</template>
