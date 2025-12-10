<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Users, Trophy, Map as MapIcon, Calendar, TrendingUp, AlertTriangle } from 'lucide-vue-next';
import { fetchTeamStats } from '../services/api';
import DataTable from '../components/DataTable.vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const route = useRoute();
const teamId = route.params.id;
const loading = ref(true);
const error = ref(null);
const stats = ref(null);

// Filters
const excludeAbandons = ref(false);
const mapFilter = ref('');
const grouping = ref('game'); // 'game' | 'day'
const metric = ref('average'); // 'average' | 'total'

const loadStats = async () => {
  loading.value = true;
  try {
    const params = {};
    if (excludeAbandons.value) params.exclude_abandons = true;
    if (mapFilter.value) params.map = mapFilter.value;
    
    stats.value = await fetchTeamStats(teamId, params);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(loadStats);

watch([excludeAbandons, mapFilter], loadStats);

// Chart Data
const chartData = computed(() => {
  if (!stats.value || !stats.value.score_history) return { labels: [], datasets: [] };
  
  const history = [...stats.value.score_history].reverse(); // Oldest first

  if (grouping.value === 'game') {
    return {
      labels: history.map(h => new Date(h.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Score',
          backgroundColor: '#a855f7',
          borderColor: '#a855f7',
          data: history.map(h => h.score),
          tension: 0.3
        }
      ]
    };
  } else {
    // Group by Day
    const days = {};
    history.forEach(h => {
      const date = new Date(h.date).toLocaleDateString();
      if (!days[date]) days[date] = { total: 0, count: 0, maps: {} };
      days[date].total += h.score;
      days[date].count++;
      
      // Track map scores for stacking
      if (!days[date].maps[h.map_name]) days[date].maps[h.map_name] = 0;
      days[date].maps[h.map_name] += h.score;
    });

    const labels = Object.keys(days);
    
    if (metric.value === 'average') {
      // Find max count for normalization
      const maxCount = Math.max(...Object.values(days).map(d => d.count));

      return {
        labels,
        datasets: [{
          label: 'Average Score',
          data: labels.map(d => Math.round(days[d].total / days[d].count)),
          backgroundColor: labels.map(d => {
            const alpha = 0.3 + (days[d].count / maxCount) * 0.7;
            return `rgba(59, 130, 246, ${alpha})`; // Blue-500
          }),
          borderColor: '#3b82f6',
          borderWidth: 1
        }]
      };
    } else {
      // Stacked by Map
      const allMaps = new Set();
      Object.values(days).forEach(d => Object.keys(d.maps).forEach(m => allMaps.add(m)));
      
      const datasets = Array.from(allMaps).map((map, i) => {
        // Generate consistent color based on map name
        const hue = (map.split('').reduce((a,c) => a+c.charCodeAt(0), 0) * 137) % 360;
        
        return {
          label: map,
          backgroundColor: `hsl(${hue}, 70%, 60%)`,
          data: labels.map(d => days[d].maps[map] || 0),
          stack: 'stack1'
        };
      });

      return { labels, datasets };
    }
  }
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: grouping.value === 'day' && metric.value === 'total', // Show legend only for stacked
      position: 'bottom',
      labels: { color: '#9ca3af' }
    },
    tooltip: {
      callbacks: {
        label: (context) => {
           if (grouping.value === 'game') {
             const point = [...stats.value.score_history].reverse()[context.dataIndex];
             return `Score: ${context.parsed.y} (${point.map_name})`;
           }
           
           if (grouping.value === 'day' && metric.value === 'average') {
             return `Average: ${context.parsed.y}`;
           }

           return `${context.dataset.label}: ${context.parsed.y}`;
        }
      }
    }
  },
  scales: {
    y: {
      stacked: grouping.value === 'day' && metric.value === 'total',
      grid: { color: '#374151' },
      ticks: { color: '#9ca3af' }
    },
    x: {
      stacked: grouping.value === 'day' && metric.value === 'total',
      grid: { display: false },
      ticks: { color: '#9ca3af' }
    }
  }
}));

// Game List Columns
const gameColumns = [
  {
    accessorKey: 'played_at',
    header: 'Date',
    cell: info => new Date(info.getValue()).toLocaleDateString(),
  },
  {
    accessorKey: 'map_name',
    header: 'Map',
  },
  {
    accessorKey: 'score',
    header: 'Score',
    cell: info => info.getValue()?.toLocaleString() ?? '-',
  },
  {
    accessorKey: 'is_finished',
    header: 'Status',
    cell: info => info.getValue() ? 'Finished' : 'Ongoing',
  }
];
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="p-3 bg-purple-500/20 rounded-full">
          <Users class="w-8 h-8 text-purple-400" />
        </div>
        <div>
          <h2 class="text-3xl font-bold text-white">Team Stats</h2>
          <p class="text-gray-400 font-mono text-sm" v-if="stats">{{ stats.team_name }}</p>
          <p class="text-gray-400 font-mono text-sm" v-else>{{ teamId }}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-4 bg-gray-800/50 p-2 rounded-lg border border-gray-700">
        <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
          <input type="checkbox" v-model="excludeAbandons" class="rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500/50">
          Exclude Abandons
        </label>
        <div class="h-4 w-px bg-gray-700"></div>
        <input 
          v-model.lazy="mapFilter" 
          placeholder="Filter by Map..." 
          class="bg-gray-700 border-none rounded px-3 py-1 text-sm text-white focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
        >
      </div>
    </header>

    <div v-if="loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
    </div>

    <div v-else-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
      {{ error }}
    </div>

    <div v-else class="space-y-6">
      <!-- Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
          <div class="text-gray-400 text-sm mb-1">Total Games</div>
          <div class="text-3xl font-bold text-white">{{ stats.total_games }}</div>
        </div>
        <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
          <div class="text-gray-400 text-sm mb-1">Average Score</div>
          <div class="text-3xl font-bold text-purple-400">{{ Math.round(stats.average_score).toLocaleString() }}</div>
        </div>
        <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
          <div class="text-gray-400 text-sm mb-1">Total Duration</div>
          <div class="text-3xl font-bold text-blue-400">{{ Math.round(stats.total_duration / 60) }}m</div>
        </div>
      </div>

      <!-- Score History Graph -->
      <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp class="w-5 h-5 text-purple-400" />
            Score History
          </h3>
          
          <div class="flex gap-2">
            <select v-model="grouping" class="bg-gray-700 border-none rounded px-3 py-1 text-sm text-white focus:ring-1 focus:ring-purple-500">
              <option value="game">By Game</option>
              <option value="day">By Day</option>
            </select>
            
            <select v-if="grouping === 'day'" v-model="metric" class="bg-gray-700 border-none rounded px-3 py-1 text-sm text-white focus:ring-1 focus:ring-purple-500">
              <option value="average">Average</option>
              <option value="total">Total (Stacked)</option>
            </select>
          </div>
        </div>
        
        <div class="h-64">
          <Line v-if="grouping === 'game'" :data="chartData" :options="chartOptions" />
          <Bar v-else :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Best/Worst Countries -->
        <div class="space-y-6">
          <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Trophy class="w-5 h-5 text-yellow-400" />
              Best Countries
            </h3>
            <div class="space-y-3">
              <div v-for="country in stats.best_countries" :key="country.country_code" class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div class="flex items-center gap-3">
                  <span :class="`fi fi-${country.country_code} rounded shadow-sm`"></span>
                  <span class="font-medium text-gray-200 uppercase">{{ country.country_code }}</span>
                </div>
                <div class="text-right">
                  <div class="text-white font-bold">{{ Math.round(country.average).toLocaleString() }}</div>
                  <div class="text-xs text-gray-400">{{ country.count }} rounds</div>
                </div>
              </div>
              <div v-if="stats.best_countries.length === 0" class="text-gray-500 text-sm text-center py-2">No data</div>
            </div>
          </div>

          <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle class="w-5 h-5 text-red-400" />
              Worst Countries
            </h3>
            <div class="space-y-3">
              <div v-for="country in stats.worst_countries" :key="country.country_code" class="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div class="flex items-center gap-3">
                  <span :class="`fi fi-${country.country_code} rounded shadow-sm`"></span>
                  <span class="font-medium text-gray-200 uppercase">{{ country.country_code }}</span>
                </div>
                <div class="text-right">
                  <div class="text-white font-bold">{{ Math.round(country.average).toLocaleString() }}</div>
                  <div class="text-xs text-gray-400">{{ country.count }} rounds</div>
                </div>
              </div>
              <div v-if="stats.worst_countries.length === 0" class="text-gray-500 text-sm text-center py-2">No data</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Game History -->
      <div class="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
        <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar class="w-5 h-5 text-gray-400" />
          Game History
        </h3>
        <DataTable :data="stats.games" :columns="gameColumns" />
      </div>
    </div>
  </div>
</template>
