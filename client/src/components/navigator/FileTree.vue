<script setup lang="ts">
import { computed, ref, inject } from 'vue';
import { CornerLeftUp } from 'lucide-vue-next';
import { useFiles } from '@/composables/useFiles';
import { useSettings } from '@/composables/useSettings';
import { useTabs } from '@/composables/useTabs';
import FileItem from './FileItem.vue';
import FolderItem from './FolderItem.vue';
import ContextMenu from '@/components/shared/ContextMenu.vue';
import type { FileNode } from '@mdump/shared';
import type { useToast } from '@/composables/useToast';

const { fileTree, loading, moveFile, moveFolder, currentListFolder, navigateUpListFolder, setSelectedFolder } = useFiles();
const { preferences } = useSettings();
const { updateTabPath } = useTabs();
const openNewNote = inject<(folderPath?: string) => void>('openNewNote')!;
const openNewFolder = inject<(folderPath?: string) => void>('openNewFolder')!;
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const viewMode = computed(() => preferences.value.defaultView);
const isEmpty = computed(() => fileTree.value.length === 0 && !loading.value);

// Root context menu
const showRootMenu = ref(false);
const rootMenuPosition = ref({ x: 0, y: 0 });

function handleRootClick(e: MouseEvent) {
  // Clicking empty space in the tree selects root folder
  if (!(e.target as HTMLElement).closest('.file-tree-item')) {
    setSelectedFolder('');
  }
}

function handleRootContextMenu(e: MouseEvent) {
  // Only show when right-clicking empty space, not on a file/folder item
  if ((e.target as HTMLElement).closest('.file-tree-item')) return;
  setSelectedFolder('');
  e.preventDefault();
  rootMenuPosition.value = { x: e.clientX, y: e.clientY };
  showRootMenu.value = true;
}

const rootMenuItems = computed(() => [
  { label: 'New Note', action: () => openNewNote() },
  { label: 'New Folder', action: () => openNewFolder() },
]);

const currentFolderContents = computed(() => {
  const path = currentListFolder.value;
  if (!path) return fileTree.value as FileNode[];

  // Navigate to the target folder in the tree
  const parts = path.split('/');
  let nodes = fileTree.value as FileNode[];
  for (const part of parts) {
    const folder = nodes.find(n => n.type === 'folder' && n.name === part);
    if (!folder || !folder.children) return [];
    nodes = folder.children as FileNode[];
  }
  return nodes;
});

const rootDragOver = ref(false);

function handleRootDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.target === e.currentTarget) {
    rootDragOver.value = true;
  }
}

function handleRootDragLeave(e: DragEvent) {
  if (e.target === e.currentTarget) {
    rootDragOver.value = false;
  }
}

async function handleRootDrop(e: DragEvent) {
  e.preventDefault();
  rootDragOver.value = false;

  const sourcePath = e.dataTransfer!.getData('application/x-mdump-path');
  const sourceType = e.dataTransfer!.getData('application/x-mdump-type');
  if (!sourcePath) return;

  // Already at root
  if (!sourcePath.includes('/')) return;

  try {
    if (sourceType === 'file') {
      await moveFile(sourcePath, '');
      const fileName = sourcePath.split('/').pop()?.replace(/\.md$/, '') || '';
      const newPath = sourcePath.split('/').pop() || '';
      updateTabPath(sourcePath, newPath, fileName);
      toast.success('File moved to root');
    } else {
      await moveFolder(sourcePath, '');
      toast.success('Folder moved to root');
    }
  } catch {
    toast.error('Failed to move item');
  }
}
</script>

<template>
  <div
    class="file-tree py-2"
    :class="{ 'bg-primary/10': rootDragOver }"
    @click="handleRootClick"
    @contextmenu="handleRootContextMenu"
    @dragover="handleRootDragOver"
    @dragleave="handleRootDragLeave"
    @drop="handleRootDrop"
  >
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <span class="loading loading-spinner loading-sm"></span>
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="text-center py-8 text-base-content/40">
      <p class="text-sm">No notes yet</p>
      <p class="text-xs mt-1">Create your first note to get started</p>
    </div>

    <!-- Tree view -->
    <template v-else-if="viewMode === 'tree'">
      <template v-for="node in (fileTree as FileNode[])" :key="node.path">
        <FolderItem
          v-if="node.type === 'folder'"
          :node="node"
          :depth="0"
        />
        <FileItem
          v-else
          :node="node"
          :depth="0"
        />
      </template>
    </template>

    <!-- List view -->
    <template v-else-if="viewMode === 'list'">
      <!-- Current path breadcrumb -->
      <div v-if="currentListFolder" class="px-2 pb-1 text-xs text-base-content/40 truncate">
        {{ currentListFolder }}
      </div>

      <!-- Back navigation -->
      <div
        v-if="currentListFolder"
        class="file-tree-item"
        @click="navigateUpListFolder"
      >
        <CornerLeftUp class="w-4 h-4 flex-shrink-0 text-base-content/60" />
        <span class="truncate flex-1">..</span>
      </div>

      <template v-for="node in currentFolderContents" :key="node.path">
        <FolderItem
          v-if="node.type === 'folder'"
          :node="node"
          :depth="0"
          :list-mode="true"
        />
        <FileItem
          v-else
          :node="node"
          :depth="0"
        />
      </template>
    </template>

    <!-- Grid view -->
    <template v-else>
      <!-- Current path breadcrumb -->
      <div v-if="currentListFolder" class="px-2 pb-1 text-xs text-base-content/40 truncate">
        {{ currentListFolder }}
      </div>

      <div class="file-grid">
        <!-- Back navigation card -->
        <div
          v-if="currentListFolder"
          class="file-grid-item"
          @click="navigateUpListFolder"
        >
          <CornerLeftUp class="w-10 h-10 text-base-content/60" />
          <span class="truncate w-full text-center text-xs">..</span>
        </div>

        <template v-for="node in currentFolderContents" :key="node.path">
          <FolderItem
            v-if="node.type === 'folder'"
            :node="node"
            :depth="0"
            :grid-mode="true"
          />
          <FileItem
            v-else
            :node="node"
            :depth="0"
            :grid-mode="true"
          />
        </template>
      </div>
    </template>

    <ContextMenu
      v-model:open="showRootMenu"
      :position="rootMenuPosition"
      :items="rootMenuItems"
    />
  </div>
</template>
