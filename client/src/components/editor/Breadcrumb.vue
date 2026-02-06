<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight, Save, Check } from 'lucide-vue-next';
import { useTabs } from '@/composables/useTabs';

const props = defineProps<{
  path: string;
  saving?: boolean;
}>();

const { getTabByPath } = useTabs();

const parts = computed(() => {
  const pathParts = props.path.split('/');
  const segments = [
    { name: 'Notes', isLast: false },
    ...pathParts.map((part, index) => ({
      name: part.replace(/\.md$/, ''),
      isLast: index === pathParts.length - 1,
    })),
  ];
  return segments;
});

const isDirty = computed(() => getTabByPath(props.path)?.isDirty ?? false);
</script>

<template>
  <div class="flex items-center gap-1 px-4 py-2 text-sm text-base-content/60 border-b border-base-300 bg-base-200/50">
    <template v-for="(part, index) in parts" :key="index">
      <span
        :class="{
          'text-base-content': part.isLast,
          'font-medium': part.isLast,
        }"
      >
        {{ part.name }}
      </span>
      <ChevronRight v-if="!part.isLast" class="w-4 h-4" />
    </template>

    <!-- Save indicator -->
    <div class="ml-auto flex items-center gap-2">
      <span v-if="saving" class="flex items-center gap-1 text-xs">
        <span class="loading loading-spinner loading-xs"></span>
        Saving...
      </span>
      <span v-else-if="isDirty" class="flex items-center gap-1 text-xs text-warning">
        <Save class="w-3 h-3" />
        Unsaved
      </span>
      <span v-else class="flex items-center gap-1 text-xs text-success">
        <Check class="w-3 h-3" />
        Saved
      </span>
    </div>
  </div>
</template>
