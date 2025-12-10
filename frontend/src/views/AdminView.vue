<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold text-white mb-8">Admin Panel</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Player List & Linking -->
      <div class="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 class="text-2xl font-bold text-white mb-4">Player Management</h2>
        
        <div class="mb-6 bg-slate-700/50 p-4 rounded-lg">
          <h3 class="text-lg font-semibold text-white mb-2">Link Players</h3>
          <p class="text-sm text-gray-400 mb-4">
            Select a "Primary" player (the main identity) and an "Alias" player (to merge into the primary).
          </p>
          
          <div class="flex flex-col gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Primary Identity (Target)</label>
              <select v-model="selectedPrimary" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white">
                <option :value="null">Select Primary Player</option>
                <option v-for="p in availablePrimaries" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.id.substring(0, 8) }}...)
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Alias Identity (Source)</label>
              <select v-model="selectedAlias" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white">
                <option :value="null">Select Alias Player</option>
                <option v-for="p in availableAliases" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.id.substring(0, 8) }}...)
                </option>
              </select>
            </div>

            <button 
              @click="linkPlayers" 
              :disabled="!canLink"
              class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Link Players
            </button>
          </div>
        </div>

        <!-- List of Players -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="text-gray-400 border-b border-slate-700">
                <th class="p-3">Name</th>
                <th class="p-3">ID</th>
                <th class="p-3">Status</th>
                <th class="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="player in sortedPlayers" :key="player.id" class="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td class="p-3 text-white">
                  <div class="flex items-center gap-2">
                    <span v-if="player.primary_id" class="text-gray-500">↳</span>
                    {{ player.name }}
                  </div>
                </td>
                <td class="p-3 text-mono text-xs text-gray-500">{{ player.id }}</td>
                <td class="p-3">
                  <span v-if="player.primary_id" class="px-2 py-1 rounded text-xs bg-purple-900/50 text-purple-300 border border-purple-700">Alias</span>
                  <span v-else-if="player.aliases && player.aliases.length > 0" class="px-2 py-1 rounded text-xs bg-green-900/50 text-green-300 border border-green-700">Primary</span>
                  <span v-else class="px-2 py-1 rounded text-xs bg-slate-700 text-gray-400">Standard</span>
                </td>
                <td class="p-3">
                  <button 
                    v-if="player.primary_id" 
                    @click="unlinkPlayer(player.id)"
                    class="text-red-400 hover:text-red-300 text-sm underline"
                  >
                    Unlink
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const players = ref([]);
const selectedPrimary = ref(null);
const selectedAlias = ref(null);

const fetchPlayers = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/admin/players');
    if (res.ok) {
      players.value = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch players", e);
  }
};

const linkPlayers = async () => {
  if (!selectedPrimary.value || !selectedAlias.value) return;
  
  try {
    const res = await fetch('http://localhost:3000/api/admin/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primary_id: selectedPrimary.value,
        alias_id: selectedAlias.value
      })
    });
    
    if (res.ok) {
      await fetchPlayers();
      selectedPrimary.value = null;
      selectedAlias.value = null;
    } else {
      alert("Failed to link players. Ensure you aren't creating a circular link.");
    }
  } catch (e) {
    console.error("Link error", e);
  }
};

const unlinkPlayer = async (aliasId) => {
  if (!confirm("Are you sure you want to unlink this player?")) return;

  try {
    const res = await fetch('http://localhost:3000/api/admin/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias_id: aliasId })
    });
    
    if (res.ok) {
      await fetchPlayers();
    }
  } catch (e) {
    console.error("Unlink error", e);
  }
};

// Computeds
const sortedPlayers = computed(() => {
  // Sort: Primaries first, then their aliases immediately after
  const result = [];
  const primaries = players.value.filter(p => !p.primary_id);
  
  primaries.forEach(p => {
    result.push(p);
    // Find aliases for this primary
    const aliases = players.value.filter(a => a.primary_id === p.id);
    result.push(...aliases);
  });
  
  return result;
});

const availablePrimaries = computed(() => {
  // Only players who are NOT aliases can be primaries
  return players.value.filter(p => !p.primary_id && p.id !== selectedAlias.value);
});

const availableAliases = computed(() => {
  // Anyone can be an alias EXCEPT the selected primary (and players who already have children - simplified check)
  return players.value.filter(p => p.id !== selectedPrimary.value && (!p.aliases || p.aliases.length === 0));
});

const canLink = computed(() => {
  return selectedPrimary.value && selectedAlias.value && selectedPrimary.value !== selectedAlias.value;
});

onMounted(() => {
  fetchPlayers();
});
</script>
