<script setup lang="ts">
import { ref } from 'vue';
import { Search, X, Folder } from 'lucide-vue-next';
import { useSearch } from '@/composables/useSearch';

const { query, scope, debouncedSearch, clearSearch, hasQuery, clearScope } = useSearch();

const inputRef = ref<HTMLInputElement | null>(null);

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  debouncedSearch(target.value);
}

function handleClear() {
  clearSearch();
  inputRef.value?.focus();
}

function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <div>
    <!-- Scope chip -->
    <div v-if="scope" class="flex items-center gap-1 mb-1.5 px-1">
      <div class="badge badge-sm badge-outline gap-1 pr-0.5">
        <Folder class="w-3 h-3" />
        <span class="truncate max-w-[140px]">{{ scope }}</span>
        <button class="p-0.5 rounded hover:bg-base-300" @click="clearScope">
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
      <input
        ref="inputRef"
        type="text"
        :value="query"
        :placeholder="scope ? `Search in ${scope}...` : 'Search notes... (Ctrl+F)'"
        class="input input-bordered input-sm w-full pl-9 pr-8"
        @input="handleInput"
      />
      <button
        v-if="hasQuery"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-base-300"
        @click="handleClear"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
