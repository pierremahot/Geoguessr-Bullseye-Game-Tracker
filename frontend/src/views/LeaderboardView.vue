<script setup>
import { ref, onMounted } from 'vue';
import { fetchTeamLeaderboard } from '../services/api';
import { Trophy, Users, Clock } from 'lucide-vue-next';

const teams = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    teams.value = await fetchTeamLeaderboard();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

function formatDuration(seconds) {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <h2 class="text-3xl font-bold text-white flex items-center gap-3">
        <Trophy class="w-8 h-8 text-yellow-400" />
        Team Leaderboard
      </h2>
    </header>

    <div v-if="loading" class="text-gray-400 animate-pulse">Loading leaderboard...</div>
    <div v-else-if="error" class="text-red-500 bg-red-900/20 p-4 rounded-lg border border-red-900">Error: {{ error }}</div>
    
    <div v-else class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-gray-300">
          <thead class="bg-gray-900/50 text-gray-100 uppercase font-medium tracking-wider">
            <tr>
              <th class="px-6 py-4 w-16 text-center">Rank</th>
              <th class="px-6 py-4">Team Members</th>
              <th class="px-6 py-4 text-center">Games</th>
              <th class="px-6 py-4 text-right">Avg Score</th>
              <th class="px-6 py-4 text-right">Total Play Time</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50">
            <tr v-for="(team, index) in teams" :key="team.team_name" 
                class="hover:bg-gray-700/30 transition-colors group cursor-pointer">
              <td class="px-6 py-4 text-center font-bold text-lg">
                <span v-if="index === 0" class="text-yellow-400">1</span>
                <span v-else-if="index === 1" class="text-gray-300">2</span>
                <span v-else-if="index === 2" class="text-amber-600">3</span>
                <span v-else class="text-gray-500">#{{ index + 1 }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <RouterLink :to="`/team/${team.members.map(m => m.id).join(',')}`" class="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors cursor-pointer">
                    <Users class="w-5 h-5 text-blue-400" />
                  </RouterLink>
                  <div>
                    <div class="flex flex-wrap gap-2">
                      <RouterLink v-for="(member, i) in team.members" :key="i" 
                            :to="`/player/${member.id}`"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 shadow-sm hover:bg-red-200 transition-colors">
                        {{ member.name }}
                      </RouterLink>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                  {{ team.games_played }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="font-bold text-lg text-green-400">{{ Math.round(team.average_score).toLocaleString() }}</div>
                <div class="text-xs text-gray-500">pts</div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 text-gray-300">
                  <Clock class="w-4 h-4 text-gray-500" />
                  {{ formatDuration(team.total_duration) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="teams.length === 0" class="p-12 text-center text-gray-500">
        No games recorded yet. Play some games to see the leaderboard!
      </div>
    </div>
  </div>
</template>
