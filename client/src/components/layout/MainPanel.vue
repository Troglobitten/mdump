<script setup lang="ts">
import { computed, inject } from 'vue';
import { FileText, PanelLeft } from 'lucide-vue-next';
import { useTabs } from '@/composables/useTabs';
import TabBar from '@/components/editor/TabBar.vue';
import EditorContainer from '@/components/editor/EditorContainer.vue';

const props = defineProps<{
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
}>();

const { tabs, activeTab, activeTabPath } = useTabs();
const openNewNote = inject<(folderPath?: string) => void>('openNewNote')!;

const hasOpenTabs = computed(() => tabs.value.length > 0);
</script>

<template>
  <main class="relative h-full flex flex-col overflow-hidden">
    <!-- Tab bar -->
    <TabBar v-if="hasOpenTabs" :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="emit('toggleSidebar')" />

    <!-- Editor or empty state -->
    <div class="flex-1 overflow-hidden">
      <EditorContainer
        v-if="activeTab"
        :key="activeTabPath ?? undefined"
        :file-path="activeTab.path"
      />

      <!-- Empty state -->
      <div
        v-else
        class="h-full flex flex-col items-center justify-center text-base-content/40"
      >
        <button
          v-if="props.sidebarCollapsed"
          class="absolute top-2 left-2 btn btn-ghost btn-sm btn-square"
          title="Toggle Sidebar (Ctrl+B)"
          @click="emit('toggleSidebar')"
        >
          <PanelLeft class="w-4 h-4" />
        </button>
        <FileText class="w-16 h-16 mb-4" />
        <p class="text-lg mb-2">No note open</p>
        <p class="text-sm mb-4">Select a note from the sidebar or create a new one</p>
        <button class="btn btn-primary btn-sm" @click="openNewNote()">
          Create New Note
        </button>
      </div>
    </div>
  </main>
</template>
