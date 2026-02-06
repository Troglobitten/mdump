<script setup lang="ts">
import { computed } from 'vue';
import { FolderTree, List, LayoutGrid } from 'lucide-vue-next';
import { useSettings } from '@/composables/useSettings';

const { preferences, updatePreferences } = useSettings();

const viewMode = computed(() => preferences.value.defaultView);

async function setView(view: 'tree' | 'list' | 'grid') {
  if (viewMode.value === view) return;
  await updatePreferences({ defaultView: view });
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <button
      class="btn btn-ghost btn-xs btn-square"
      :class="{ 'btn-active': viewMode === 'tree' }"
      title="Tree view"
      @click="setView('tree')"
    >
      <FolderTree class="w-3.5 h-3.5" />
    </button>
    <button
      class="btn btn-ghost btn-xs btn-square"
      :class="{ 'btn-active': viewMode === 'list' }"
      title="List view"
      @click="setView('list')"
    >
      <List class="w-3.5 h-3.5" />
    </button>
    <button
      class="btn btn-ghost btn-xs btn-square"
      :class="{ 'btn-active': viewMode === 'grid' }"
      title="Grid view"
      @click="setView('grid')"
    >
      <LayoutGrid class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
