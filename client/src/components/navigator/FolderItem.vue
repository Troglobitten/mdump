<script setup lang="ts">
import { computed, ref, inject } from 'vue';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-vue-next';
import type { FileNode } from '@mdump/shared';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSearch } from '@/composables/useSearch';
import type { useToast } from '@/composables/useToast';
import FileItem from './FileItem.vue';
import ContextMenu from '@/components/shared/ContextMenu.vue';
import RenameModal from '@/components/modals/RenameModal.vue';
import MoveModal from '@/components/modals/MoveModal.vue';

const props = defineProps<{
  node: FileNode;
  depth: number;
  listMode?: boolean;
  gridMode?: boolean;
}>();

const { toggleFolder, isFolderExpanded, deleteFolder, renameFolder, moveFolder, moveFile, setSelectedFolder, selectedFolder, setCurrentListFolder } = useFiles();
const { updateTabPath } = useTabs();
const { setScope } = useSearch();
const toast = inject<ReturnType<typeof useToast>>('toast')!;
const confirm = inject<(title: string, message: string, onConfirm: () => void) => void>('confirm')!;
const openNewNote = inject<(folderPath?: string) => void>('openNewNote')!;
const openNewFolder = inject<(folderPath?: string) => void>('openNewFolder')!;

const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const showRenameModal = ref(false);
const showMoveModal = ref(false);
const dragOver = ref(false);

const isExpanded = computed(() => isFolderExpanded(props.node.path));
const isSelected = computed(() => selectedFolder.value === props.node.path);
const paddingLeft = computed(() => `${props.depth * 16 + 8}px`);
const hasChildren = computed(
  () => props.node.children && props.node.children.length > 0
);

function handleClick() {
  setSelectedFolder(props.node.path);
  if (props.listMode || props.gridMode) {
    setCurrentListFolder(props.node.path);
  } else {
    toggleFolder(props.node.path);
  }
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  showContextMenu.value = true;
}

function handleNewNote() {
  openNewNote(props.node.path);
}

function handleNewFolder() {
  openNewFolder(props.node.path);
}

async function handleDelete() {
  confirm(
    'Delete Folder',
    `Are you sure you want to delete "${props.node.name}" and all its contents? This cannot be undone.`,
    async () => {
      try {
        await deleteFolder(props.node.path);
        toast.success('Folder deleted');
      } catch (error) {
        toast.error('Failed to delete folder');
      }
    }
  );
}

async function handleRename(newName: string) {
  try {
    const newPath = await renameFolder(props.node.path, newName);
    // Update any tabs that were inside this folder
    updateTabPath(props.node.path, newPath, newName);
    toast.success('Folder renamed');
  } catch (error) {
    toast.error('Failed to rename folder');
  }
}

async function handleMove(destination: string) {
  try {
    await moveFolder(props.node.path, destination);
    toast.success('Folder moved');
  } catch (error) {
    toast.error('Failed to move folder');
  }
}

function handleSearchInFolder() {
  setScope(props.node.path);
}

function handleDragStart(e: DragEvent) {
  e.dataTransfer!.setData('application/x-mdump-path', props.node.path);
  e.dataTransfer!.setData('application/x-mdump-type', 'folder');
  e.dataTransfer!.effectAllowed = 'move';
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  dragOver.value = true;
}

function handleDragLeave() {
  dragOver.value = false;
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  dragOver.value = false;

  const sourcePath = e.dataTransfer!.getData('application/x-mdump-path');
  const sourceType = e.dataTransfer!.getData('application/x-mdump-type');
  if (!sourcePath || sourcePath === props.node.path) return;

  // Prevent dropping a folder into itself or its children
  if (sourceType === 'folder' && props.node.path.startsWith(sourcePath + '/')) return;

  try {
    if (sourceType === 'file') {
      await moveFile(sourcePath, props.node.path);
      const fileName = sourcePath.split('/').pop()?.replace(/\.md$/, '') || '';
      const newPath = `${props.node.path}/${sourcePath.split('/').pop()}`;
      updateTabPath(sourcePath, newPath, fileName);
      toast.success('File moved');
    } else {
      await moveFolder(sourcePath, props.node.path);
      toast.success('Folder moved');
    }
  } catch {
    toast.error('Failed to move item');
  }
}

const contextMenuItems = computed(() => [
  { label: 'New Note', action: handleNewNote },
  { label: 'New Folder', action: handleNewFolder },
  { separator: true },
  { label: 'Rename', action: () => { showRenameModal.value = true; } },
  { label: 'Move', action: () => { showMoveModal.value = true; } },
  { label: 'Search in Folder', action: handleSearchInFolder },
  { separator: true },
  { label: 'Delete', action: handleDelete, danger: true },
]);
</script>

<template>
  <div>
    <!-- Grid mode card -->
    <div
      v-if="gridMode"
      class="file-grid-item"
      :class="{ 'bg-primary/20': dragOver }"
      draggable="true"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      @dragstart="handleDragStart"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <Folder class="w-10 h-10 text-warning" />
      <span class="truncate w-full text-center text-xs">{{ node.name }}</span>
    </div>

    <!-- Tree / List mode -->
    <div
      v-else
      class="file-tree-item"
      :class="{ 'bg-primary/20': dragOver, 'bg-base-300/50': isSelected && !dragOver }"
      :style="{ paddingLeft }"
      draggable="true"
      @click="handleClick"
      @contextmenu="handleContextMenu"
      @dragstart="handleDragStart"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <component
        v-if="!listMode"
        :is="isExpanded ? ChevronDown : ChevronRight"
        class="w-4 h-4 flex-shrink-0 text-base-content/60"
      />
      <component
        :is="isExpanded ? FolderOpen : Folder"
        class="w-4 h-4 flex-shrink-0 text-warning"
      />
      <span class="truncate flex-1">{{ node.name }}</span>
    </div>

    <!-- Children (tree view only) -->
    <div v-if="!listMode && !gridMode && isExpanded && hasChildren">
      <template v-for="child in node.children" :key="child.path">
        <FolderItem
          v-if="child.type === 'folder'"
          :node="child"
          :depth="depth + 1"
        />
        <FileItem
          v-else
          :node="child"
          :depth="depth + 1"
        />
      </template>
    </div>

    <ContextMenu
      v-model:open="showContextMenu"
      :position="contextMenuPosition"
      :items="contextMenuItems"
    />

    <RenameModal
      v-model:open="showRenameModal"
      :current-name="node.name"
      type="folder"
      @renamed="handleRename"
    />

    <MoveModal
      v-model:open="showMoveModal"
      :current-path="node.path"
      type="folder"
      @moved="handleMove"
    />
  </div>
</template>
