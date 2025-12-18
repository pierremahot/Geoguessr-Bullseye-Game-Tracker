<script setup>
import { ref, computed, h } from 'vue';
import {
  useVueTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  FlexRender,
} from '@tanstack/vue-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-vue-next';

const props = defineProps({
  data: {
    type: Array,
    required: true,
  },
  columns: {
    type: Array,
    required: true,
  },
});

const sorting = ref([]);
const columnFilters = ref([]);

const table = useVueTable({
  get data() {
    return props.data;
  },
  columns: props.columns,
  state: {
    get sorting() {
      return sorting.value;
    },
    get columnFilters() {
      return columnFilters.value;
    },
  },
  onSortingChange: (updaterOrValue) => {
    sorting.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting.value)
        : updaterOrValue;
  },
  onColumnFiltersChange: (updaterOrValue) => {
    columnFilters.value =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(columnFilters.value)
        : updaterOrValue;
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});

// Filter Components
const FilterInput = ({ column }) => {
  const columnFilterValue = column.getFilterValue();
  const { filterVariant } = column.columnDef.meta ?? {};

  if (filterVariant === 'range') {
    return h('div', { class: 'flex space-x-2' }, [
      h('input', {
        type: 'number',
        value: columnFilterValue?.[0] ?? '',
        onChange: (e) =>
          column.setFilterValue((old) => [e.target.value, old?.[1]]),
        placeholder: 'Min',
        class:
          'w-20 px-2 py-1 text-xs bg-gray-700/50 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500',
      }),
      h('input', {
        type: 'number',
        value: columnFilterValue?.[1] ?? '',
        onChange: (e) =>
          column.setFilterValue((old) => [old?.[0], e.target.value]),
        placeholder: 'Max',
        class:
          'w-20 px-2 py-1 text-xs bg-gray-700/50 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500',
      }),
    ]);
  }

  if (filterVariant === 'select') {
    return h(
      'select',
      {
        onChange: (e) => column.setFilterValue(e.target.value),
        value: columnFilterValue?.toString() ?? '',
        class:
          'w-full px-2 py-1 text-xs bg-gray-700/50 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500',
      },
      [
        h('option', { value: '' }, 'All'),
        h('option', { value: 'true' }, 'Finished'),
        h('option', { value: 'false' }, 'Ongoing'),
      ]
    );
  }

  return h('div', { class: 'relative' }, [
    h(Search, { class: 'absolute left-2 top-1.5 w-3 h-3 text-gray-500' }),
    h('input', {
      type: 'text',
      value: columnFilterValue ?? '',
      onInput: (e) => column.setFilterValue(e.target.value),
      placeholder: `Filter...`,
      class:
        'w-full pl-7 pr-2 py-1 text-xs bg-gray-700/50 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500',
    }),
  ]);
};
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex-grow overflow-auto custom-scrollbar w-full">
      <table class="min-w-full text-left text-sm text-gray-300">
        <thead
          class="bg-gray-900/80 text-gray-100 uppercase font-medium tracking-wider sticky top-0 z-10 backdrop-blur-md"
        >
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-6 py-4 whitespace-nowrap border-b border-gray-700/50 bg-gray-900/90"
              :class="{
                'cursor-pointer hover:bg-gray-800/50':
                  header.column.getCanSort(),
              }"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <ArrowUpDown
                    v-if="header.column.getCanSort()"
                    class="w-3 h-3 text-gray-500"
                  />
                </div>
                <div v-if="header.column.getCanFilter()" @click.stop>
                  <FilterInput :column="header.column" />
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-700/50">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="hover:bg-gray-700/30 transition-colors group"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-6 py-4 whitespace-nowrap"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      class="flex items-center justify-between px-6 py-3 border-t border-gray-700 bg-gray-800/50 backdrop-blur-sm"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">
          Page
          <span class="font-medium text-white">{{
            table.getState().pagination.pageIndex + 1
          }}</span>
          of
          <span class="font-medium text-white">{{ table.getPageCount() }}</span>
        </span>
      </div>
      <div class="flex gap-2">
        <button
          class="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
          @click="table.previousPage()"
          :disabled="!table.getCanPreviousPage()"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <button
          class="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
          @click="table.nextPage()"
          :disabled="!table.getCanNextPage()"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 1);
}
</style>
