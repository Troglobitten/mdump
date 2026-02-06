<script setup lang="ts">
import { FileText } from 'lucide-vue-next';
import { useSearch } from '@/composables/useSearch';
import { useTabs } from '@/composables/useTabs';

const { results, loading, hasResults, clearSearch } = useSearch();
const { openTab, activeTabPath } = useTabs();

function handleClick(path: string, name: string) {
  openTab(path, name);
  clearSearch();
}
</script>

<template>
  <div class="py-2">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <span class="loading loading-spinner loading-sm"></span>
    </div>

    <!-- No results -->
    <div v-else-if="!hasResults" class="text-center py-8 text-base-content/40">
      <p class="text-sm">No results found</p>
    </div>

    <!-- Results list -->
    <div v-else class="space-y-1">
      <div
        v-for="result in results"
        :key="result.path"
        class="search-result"
        :class="{ active: activeTabPath === result.path }"
        @click="handleClick(result.path, result.name)"
      >
        <div class="flex items-center gap-2">
          <FileText class="w-4 h-4 flex-shrink-0 text-base-content/60" />
          <span class="truncate font-medium">{{ result.name }}</span>
        </div>
        <div class="text-xs text-base-content/40 truncate ml-6">
          {{ result.path }}
        </div>
        <div
          v-if="result.matches.length > 0"
          class="text-xs text-base-content/60 ml-6 mt-1 truncate"
        >
          {{ result.matches[0].snippet }}
        </div>
      </div>
    </div>
  </div>
</template>
