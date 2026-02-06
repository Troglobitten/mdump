<script setup lang="ts">
import { ref, onMounted, provide, inject } from 'vue';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import { useWebSocket } from '@/composables/useWebSocket';
import type { useToast } from '@/composables/useToast';
import type { FileChangeEvent } from '@mdump/shared';
import Sidebar from './Sidebar.vue';
import MainPanel from './MainPanel.vue';
import SettingsModal from '@/components/modals/SettingsModal.vue';
import ConfirmModal from '@/components/modals/ConfirmModal.vue';
import NewNoteModal from '@/components/modals/NewNoteModal.vue';
import NewFolderModal from '@/components/modals/NewFolderModal.vue';

const { loadFileTree, wasRecentlySaved } = useFiles();
const { loadTabs, nextTab, prevTab, activeTab } = useTabs();
const { preferences } = useSettings();
const { registerShortcuts } = useKeyboard();
const { subscribe } = useWebSocket();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

// Modal state
const showSettings = ref(false);
const showNewNote = ref(false);
const showNewFolder = ref(false);
const confirmModal = ref<{
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}>({
  show: false,
  title: '',
  message: '',
  onConfirm: () => {},
});

// Sidebar state
const sidebarCollapsed = ref(false);
const sidebarWidth = ref(280);

// Provide modal controls to children
provide('openSettings', () => (showSettings.value = true));
provide('openNewNote', (folderPath?: string) => {
  newNoteFolderPath.value = folderPath || '';
  showNewNote.value = true;
});
provide('openNewFolder', (folderPath?: string) => {
  newFolderParentPath.value = folderPath || '';
  showNewFolder.value = true;
});
provide('confirm', (title: string, message: string, onConfirm: () => void) => {
  confirmModal.value = { show: true, title, message, onConfirm };
});

const newNoteFolderPath = ref('');
const newFolderParentPath = ref('');
const externalReloadPath = ref<string | null>(null);
provide('externalReloadPath', externalReloadPath);

onMounted(async () => {
  try {
    await Promise.all([loadFileTree(), loadTabs()]);
  } catch (error) {
    toast.error('Failed to load data');
  }

  // Set up keyboard shortcuts
  registerShortcuts([
    { shortcut: 'ctrl+n', handler: () => (showNewNote.value = true) },
    { shortcut: 'ctrl+,', handler: () => (showSettings.value = true) },
    { shortcut: 'ctrl+b', handler: () => (sidebarCollapsed.value = !sidebarCollapsed.value) },
    { shortcut: 'ctrl+tab', handler: nextTab },
    { shortcut: 'ctrl+shift+tab', handler: prevTab },
  ]);

  // Subscribe to WebSocket events
  subscribe((event: FileChangeEvent) => {
    handleFileChange(event);
  });
});

function handleFileChange(event: FileChangeEvent) {
  // Reload file tree on any change
  loadFileTree();

  if (event.type === 'modified') {
    const tab = activeTab.value;
    if (tab && event.path === tab.path) {
      if (wasRecentlySaved(event.path)) {
        // Our own save triggered this — no reload needed
      } else {
        // Genuine external change
        if (preferences.value.externalChangeWarning) {
          toast.warning('File was modified externally');
        }
        externalReloadPath.value = event.path;
      }
    }
  }

  // Close tab if file was deleted
  if (event.type === 'deleted') {
    const tabs = useTabs();
    const tab = tabs.getTabByPath(event.path);
    if (tab) {
      tabs.forceCloseTab(event.path);
      toast.info('File was deleted externally');
    }
  }
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function handleSidebarResize(width: number) {
  sidebarWidth.value = width;
}

function handleConfirm() {
  confirmModal.value.onConfirm();
  confirmModal.value.show = false;
}
</script>

<template>
  <div class="h-full w-full flex overflow-hidden bg-base-100">
    <!-- Sidebar -->
    <Sidebar
      :collapsed="sidebarCollapsed"
      :width="sidebarWidth"
      @toggle="toggleSidebar"
      @resize="handleSidebarResize"
    />

    <!-- Main content -->
    <MainPanel class="flex-1" :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="toggleSidebar" />

    <!-- Modals -->
    <SettingsModal v-model:open="showSettings" />

    <NewNoteModal
      v-model:open="showNewNote"
      :folder-path="newNoteFolderPath"
    />

    <NewFolderModal
      v-model:open="showNewFolder"
      :folder-path="newFolderParentPath"
    />

    <ConfirmModal
      v-model:open="confirmModal.show"
      :title="confirmModal.title"
      :message="confirmModal.message"
      @confirm="handleConfirm"
    />
  </div>
</template>
