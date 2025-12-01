<script setup>
import { ref, onMounted, h } from 'vue';
import { RouterLink } from 'vue-router';
import { fetchGames } from '../services/api';
import DataTable from './DataTable.vue';
import { History, Clock, Users, Map as MapIcon, Hash, Flag, Trophy } from 'lucide-vue-next';

const games = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const data = await fetchGames();
    if (data) {
      games.value = data;
    }
  } catch (err) {
    console.error('Failed to fetch games:', err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

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
    cell: info => h('span', { class: 'font-mono text-xs text-gray-500 select-all', title: info.getValue() }, info.getValue() ? info.getValue().substring(0, 8) + '...' : '-'),
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
      return h('div', { class: 'flex flex-col gap-1' }, players.map(p => 
        h(RouterLink, { 
          to: `/player/${p.id}`, 
          class: 'text-white font-medium text-xs hover:text-blue-400 transition-colors' 
        }, () => p.name)
      ));
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
];

</script>

<template>
  <div class="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 shadow-xl flex flex-col h-[calc(100vh-12rem)]">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-white flex items-center gap-2">
        <History class="w-6 h-6 text-purple-400" />
        Game History
      </h2>
      <div v-if="loading" class="text-gray-400 text-sm animate-pulse">Loading...</div>
    </div>
    
    <DataTable :data="games" :columns="columns" />
  </div>
</template>
