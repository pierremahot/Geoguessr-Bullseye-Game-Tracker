<script setup>
import { ref, onMounted, h } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchGames, fetchStats, deleteGame } from '../services/api';
import DataTable from './DataTable.vue';
import { History, Clock, Users, Map as MapIcon, Hash, Flag, Trophy, Trash2 } from 'lucide-vue-next';

const games = ref([]);
const totalGames = ref(0);
const loading = ref(true);
const error = ref(null);

const loadData = async () => {
  loading.value = true;
  try {
    const [gamesData, statsData] = await Promise.all([
      fetchGames(),
      fetchStats()
    ]);
    
    if (gamesData) {
      games.value = gamesData;
    }
    if (statsData) {
      totalGames.value = statsData.total_games;
    }
  } catch (err) {
    console.error('Failed to fetch data:', err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);

async function handleDelete(id) {
  if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
    return;
  }

  try {
    await deleteGame(id);
    await loadData(); // Refresh list
  } catch (err) {
    alert('Failed to delete game: ' + err.message);
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const columns = [
  {
    accessorKey: 'played_at',
    header: () => h('div', { class: 'flex items-center gap-2' }, [h(Clock, { class: 'w-4 h-4' }), 'Date']),
    cell: info => h('span', { class: 'text-gray-400 font-mono text-xs whitespace-nowrap' }, formatDate(info.getValue())),
  },
  {
    accessorKey: 'game_id',
    header: () => h('div', { class: 'flex items-center gap-2' }, [h(Hash, { class: 'w-4 h-4' }), 'ID']),
    cell: info => {
      const gameId = info.getValue();
      if (!gameId) return h('span', { class: 'text-gray-500' }, '-');
      
      return h('a', { 
        href: `https://www.geoguessr.com/fr/bullseye/${gameId}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline select-all',
        title: gameId 
      }, gameId.substring(0, 8) + '...');
    },
  },
  {
    accessorKey: 'country_codes',
    header: () => h('div', { class: 'flex items-center gap-2' }, [h(Flag, { class: 'w-4 h-4' }), 'Flags']),
    cell: info => {
      const codes = info.getValue() || [];
      if (codes.length === 0) return h('span', { class: 'text-gray-600 text-xs' }, '-');

      // Group counts
      const counts = codes.reduce((acc, code) => {
        const lower = code.toLowerCase();
        acc[lower] = (acc[lower] || 0) + 1;
        return acc;
      }, {});

      return h('div', { class: 'flex flex-wrap gap-2' }, 
        Object.entries(counts).map(([code, count]) => {
          const flagEl = h('span', { 
            class: `fi fi-${code} w-6 h-4 rounded shadow-sm ring-1 ring-gray-800`,
            title: code.toUpperCase()
          });
          
          if (count > 1) {
            return h('div', { class: 'relative inline-flex' }, [
              flagEl,
              h('span', { 
                class: 'absolute -top-2 -right-2 bg-gray-700 text-white text-[10px] font-bold px-1 rounded-full border border-gray-600 shadow-sm' 
              }, count)
            ]);
          }
          return flagEl;
        })
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'players',
    header: () => h('div', { class: 'flex items-center gap-2' }, [h(Users, { class: 'w-4 h-4' }), 'Players']),
    cell: info => {
      const players = info.getValue() || [];
      if (players.length === 0) return h('span', { class: 'text-gray-500 text-xs' }, 'Unknown');
      
      const playerList = h('div', { class: 'flex flex-col gap-1' }, players.map(p => 
        h(RouterLink, { 
          to: `/player/${p.id}`, 
          class: 'text-white font-medium text-xs hover:text-blue-400 transition-colors' 
        }, () => p.name)
      ));

      if (players.length > 1) {
        const teamId = players.map(p => p.id).sort().join(',');
        return h('div', { class: 'flex items-start gap-2' }, [
          h(RouterLink, {
            to: `/team/${teamId}`,
            class: 'p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors text-purple-400',
            title: 'View Team Stats'
          }, () => h(Users, { class: 'w-3 h-3' })),
          playerList
        ]);
      }

      return playerList;
    },
    filterFn: (row, columnId, filterValue) => {
      const players = row.getValue(columnId);
      return players.some(p => p.name.toLowerCase().includes(filterValue.toLowerCase()));
    }
  },
  {
    accessorKey: 'map_name',
    header: () => h('div', { class: 'flex items-center gap-2' }, [h(MapIcon, { class: 'w-4 h-4' }), 'Map']),
    cell: info => h('span', { class: 'text-gray-300' }, info.getValue() || 'Unknown'),
  },
  {
    accessorKey: 'score',
    header: () => h('div', { class: 'flex items-center gap-2 justify-end' }, [h(Trophy, { class: 'w-4 h-4' }), 'Score']),
    cell: info => {
      const score = info.getValue();
      const max = info.row.original.max_score;
      return h('div', { class: 'text-right' }, [
        h('span', { class: 'font-bold text-green-400' }, score),
        h('span', { class: 'text-gray-500 text-xs' }, ` / ${max}`)
      ]);
    },
    meta: { filterVariant: 'range' },
    filterFn: (row, columnId, filterValue) => {
      const [min, max] = filterValue || [];
      const val = row.getValue(columnId);
      if (min && val < min) return false;
      if (max && val > max) return false;
      return true;
    }
  },
  {
    accessorKey: 'is_finished',
    header: 'Status',
    cell: info => {
      const isFinished = info.getValue();
      return isFinished 
        ? h('span', { class: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-800' }, 'Finished')
        : h('span', { class: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-800' }, 'Ongoing');
    },
    meta: { filterVariant: 'select' },
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      return String(row.getValue(columnId)) === filterValue;
    }
  },
  {
    accessorKey: 'total_duration',
    header: () => h('div', { class: 'text-right' }, 'Duration'),
    cell: info => h('div', { class: 'text-right font-mono text-xs text-gray-400' }, formatDuration(info.getValue())),
  },
  {
    id: 'actions',
    header: '',
    cell: info => h('button', {
      onClick: () => handleDelete(info.row.original.id),
      class: 'p-2 text-gray-500 hover:text-red-500 transition-colors rounded hover:bg-red-500/10',
      title: 'Delete Game'
    }, h(Trash2, { class: 'w-4 h-4' })),
    enableSorting: false,
  }
];

</script>

<template>
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 flex flex-col h-[calc(100vh-12rem)] w-full overflow-hidden">
    <div class="flex justify-between items-center p-6 border-b border-gray-700/50">
      <h2 class="text-2xl font-bold text-white flex items-center gap-2">
        <History class="w-6 h-6 text-purple-400" />
        Game History
        <span v-if="totalGames > 0" class="text-sm font-normal text-gray-400 ml-2">({{ totalGames }} total)</span>
      </h2>
      <div v-if="loading" class="text-gray-400 text-sm animate-pulse">Loading...</div>
    </div>
    
    <div class="flex-grow min-h-0 w-full">
      <DataTable :data="games" :columns="columns" />
    </div>
  </div>
</template>
