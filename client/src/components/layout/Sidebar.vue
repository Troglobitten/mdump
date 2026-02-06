<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { PanelLeftClose, Plus, Settings, LogOut, FileText, FolderPlus } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useFiles } from '@/composables/useFiles';
import { useSearch } from '@/composables/useSearch';
import { useTabs } from '@/composables/useTabs';
import type { useToast } from '@/composables/useToast';
import FileTree from '@/components/navigator/FileTree.vue';
import SearchBar from '@/components/navigator/SearchBar.vue';
import SearchResults from '@/components/navigator/SearchResults.vue';
import ViewToggle from '@/components/navigator/ViewToggle.vue';

const props = defineProps<{
  collapsed: boolean;
  width: number;
}>();

const emit = defineEmits<{
  toggle: [];
  resize: [width: number];
}>();

const { logout } = useAuth();
const { selectedFolder } = useFiles();
const { hasQuery } = useSearch();
const { activeTabPath } = useTabs();
const toast = inject<ReturnType<typeof useToast>>('toast')!;
const openNewNote = inject<(folderPath?: string) => void>('openNewNote')!;
const openNewFolder = inject<(folderPath?: string) => void>('openNewFolder')!;
const openSettings = inject<() => void>('openSettings')!;

const isResizing = ref(false);
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null);
const showCreateDropdown = ref(false);

const activeFolder = computed(() => {
  if (selectedFolder.value !== null) return selectedFolder.value;
  const path = activeTabPath.value;
  if (!path) return '';
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.substring(0, lastSlash) : '';
});

const sidebarStyle = computed(() => ({
  width: props.collapsed ? '0px' : `${props.width}px`,
  minWidth: props.collapsed ? '0px' : `${props.width}px`,
}));

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = props.width;

  function onMouseMove(e: MouseEvent) {
    const newWidth = Math.max(200, Math.min(500, startWidth + e.clientX - startX));
    emit('resize', newWidth);
  }

  function onMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

async function handleLogout() {
  try {
    await logout();
    toast.success('Logged out successfully');
  } catch (error) {
    toast.error('Failed to logout');
  }
}

function handleNewNote() {
  showCreateDropdown.value = false;
  openNewNote(activeFolder.value || undefined);
}

function handleNewFolder() {
  showCreateDropdown.value = false;
  openNewFolder(activeFolder.value || undefined);
}

function focusSearch() {
  searchBarRef.value?.focus();
}

defineExpose({ focusSearch });
</script>

<template>
  <aside
    class="h-full bg-base-200 flex flex-col relative transition-all duration-200 overflow-hidden"
    :style="sidebarStyle"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
      <div class="flex items-center gap-2">
        <img src="/favicon.svg" alt="mdump" class="w-5 h-5" />
        <h1 class="font-semibold text-lg">mdump</h1>
      </div>
      <div class="flex items-center gap-1">
        <div class="dropdown dropdown-end">
          <button
            class="btn btn-ghost btn-sm btn-square"
            title="New... (Ctrl+N)"
            @click="showCreateDropdown = !showCreateDropdown"
          >
            <Plus class="w-4 h-4" />
          </button>
          <ul
            v-if="showCreateDropdown"
            class="dropdown-content menu bg-base-100 rounded-lg shadow-xl z-50 w-44 p-1 border border-base-300"
          >
            <li>
              <button @click="handleNewNote" class="flex items-center gap-2">
                <FileText class="w-4 h-4" />
                New Note
              </button>
            </li>
            <li>
              <button @click="handleNewFolder" class="flex items-center gap-2">
                <FolderPlus class="w-4 h-4" />
                New Folder
              </button>
            </li>
          </ul>
        </div>
        <button
          class="btn btn-ghost btn-sm btn-square"
          title="Toggle Sidebar (Ctrl+B)"
          @click="$emit('toggle')"
        >
          <PanelLeftClose class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="px-3 py-2">
      <SearchBar ref="searchBarRef" />
    </div>

    <!-- Files header with view toggle -->
    <div v-if="!hasQuery" class="flex items-center justify-between px-3 py-1">
      <span class="text-xs font-medium text-base-content/50 uppercase tracking-wide">Files</span>
      <ViewToggle />
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-2">
      <SearchResults v-if="hasQuery" />
      <FileTree v-else />
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-3 py-2 border-t border-base-300">
      <button
        class="btn btn-ghost btn-sm btn-square"
        title="Settings (Ctrl+,)"
        @click="openSettings"
      >
        <Settings class="w-4 h-4" />
      </button>
      <button
        class="btn btn-ghost btn-sm btn-square"
        title="Logout"
        @click="handleLogout"
      >
        <LogOut class="w-4 h-4" />
      </button>
    </div>

    <!-- Resize handle -->
    <div
      class="resize-handle absolute right-0 top-0 bottom-0"
      @mousedown="startResize"
    ></div>
  </aside>


</template>
