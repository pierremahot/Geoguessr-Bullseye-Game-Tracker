<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Users } from 'lucide-vue-next';

const route = useRoute();
const teamId = route.params.id; // Comma separated IDs
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  // TODO: Fetch team stats
  loading.value = false;
});
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center gap-4">
      <div class="p-3 bg-purple-500/20 rounded-full">
        <Users class="w-8 h-8 text-purple-400" />
      </div>
      <div>
        <h2 class="text-3xl font-bold text-white">Team Stats</h2>
        <p class="text-gray-400 font-mono text-sm">Members: {{ teamId }}</p>
      </div>
    </header>

    <div class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl">
      <p class="text-gray-300">Detailed stats for this team coming soon...</p>
    </div>
  </div>
</template>
