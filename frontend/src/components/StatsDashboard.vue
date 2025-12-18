<script setup>
import { ref, onMounted } from 'vue';
import { fetchStats } from '../services/api';
import { Activity, Globe } from 'lucide-vue-next';

const stats = ref(null);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    stats.value = await fetchStats();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

function formatDuration(seconds) {
  if (!seconds) return '0h 0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Global Stats -->
    <div
      class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl"
    >
      <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        <Activity class="w-6 h-6 text-blue-400" />
        Global Stats
      </h2>
      <div v-if="stats" class="grid grid-cols-2 gap-4">
        <div
          class="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600/50"
        >
          <div class="text-3xl font-bold text-blue-400">
            {{ stats.total_games }}
          </div>
          <div class="text-sm text-gray-400 font-medium">Games Played</div>
        </div>
        <div
          class="bg-gray-700/50 p-4 rounded-lg text-center border border-gray-600/50"
        >
          <div class="text-3xl font-bold text-green-400">
            {{ Math.round(stats.average_score) }}
          </div>
          <div class="text-sm text-gray-400 font-medium">Avg Score</div>
        </div>
        <div
          class="bg-gray-700/50 p-4 rounded-lg text-center col-span-2 border border-gray-600/50"
        >
          <div class="text-3xl font-bold text-purple-400">
            {{ formatDuration(stats.total_duration_seconds) }}
          </div>
          <div class="text-sm text-gray-400 font-medium">Total Play Time</div>
        </div>
      </div>
      <div v-else-if="loading" class="text-gray-400 animate-pulse">
        Loading stats...
      </div>
    </div>

    <!-- Best Countries -->
    <div
      class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl"
    >
      <h2 class="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        <Globe class="w-6 h-6 text-green-400" />
        Best Countries
      </h2>
      <div
        v-if="stats && stats.best_country_guesses.length > 0"
        class="overflow-y-auto max-h-64 pr-2 custom-scrollbar"
      >
        <table class="w-full text-left text-sm text-gray-300">
          <thead
            class="bg-gray-900/50 text-gray-100 sticky top-0 backdrop-blur-md"
          >
            <tr>
              <th class="px-3 py-2 rounded-l-lg">Country</th>
              <th class="px-3 py-2 text-right">Avg Score</th>
              <th class="px-3 py-2 text-right rounded-r-lg">Guesses</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50">
            <tr
              v-for="country in stats.best_country_guesses"
              :key="country.country_code"
              class="hover:bg-gray-700/30 transition-colors"
            >
              <td
                class="px-3 py-3 uppercase font-mono font-bold tracking-wider"
              >
                {{ country.country_code }}
              </td>
              <td class="px-3 py-3 font-bold text-yellow-400 text-right">
                {{ Math.round(country.average) }}
              </td>
              <td class="px-3 py-3 text-right text-gray-400">
                {{ country.count }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="loading" class="text-gray-400 animate-pulse">
        Loading countries...
      </div>
      <div v-else class="text-gray-500 italic text-center py-8">
        No country data available.
      </div>
    </div>
  </div>
</template>
