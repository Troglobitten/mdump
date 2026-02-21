<script setup lang="ts">
import { useOutline } from '@/composables/useOutline';
import { useTabs } from '@/composables/useTabs';

const { headings, scrollToHeading } = useOutline();
const { activeTabPath } = useTabs();
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center px-3 py-1 border-b border-base-300 shrink-0">
      <span class="text-xs font-medium text-base-content/50 uppercase tracking-wide">Outline</span>
    </div>

    <!-- Empty states -->
    <div v-if="!activeTabPath" class="px-3 py-2 text-xs text-base-content/40 italic">
      No file open
    </div>
    <div v-else-if="headings.length === 0" class="px-3 py-2 text-xs text-base-content/40 italic">
      No headings
    </div>

    <!-- Heading list -->
    <ul v-else class="overflow-y-auto flex-1 py-1">
      <li
        v-for="(h, i) in headings"
        :key="i"
        class="flex items-center gap-1 cursor-pointer hover:bg-base-300 rounded py-0.5 pr-2 text-sm leading-tight"
        :style="{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }"
        :title="h.text"
        @click="scrollToHeading(h.id)"
      >
        <span class="text-base-content/30 text-xs shrink-0 w-5">H{{ h.level }}</span>
        <span class="truncate">{{ h.text }}</span>
      </li>
    </ul>
  </div>
</template>
