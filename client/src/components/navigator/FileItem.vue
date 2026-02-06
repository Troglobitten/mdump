<script setup lang="ts">
import { computed, ref, inject } from 'vue';
import { FileText } from 'lucide-vue-next';
import type { FileNode } from '@mdump/shared';
import { useTabs } from '@/composables/useTabs';
import { useFiles } from '@/composables/useFiles';
import type { useToast } from '@/composables/useToast';
import ContextMenu from '@/components/shared/ContextMenu.vue';
import RenameModal from '@/components/modals/RenameModal.vue';
import MoveModal from '@/components/modals/MoveModal.vue';

const props = defineProps<{
  node: FileNode;
  depth: number;
  showFolderPath?: boolean;
  gridMode?: boolean;
}>();

const { openTab, activeTabPath, getTabByPath, updateTabPath } = useTabs();
const { deleteFile, duplicateFile, renameFile, moveFile, setSelectedFolder } = useFiles();
const toast = inject<ReturnType<typeof useToast>>('toast')!;
const confirm = inject<(title: string, message: string, onConfirm: () => void) => void>('confirm')!;

const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const showRenameModal = ref(false);
const showMoveModal = ref(false);

const isActive = computed(() => activeTabPath.value === props.node.path);
const isDirty = computed(() => getTabByPath(props.node.path)?.isDirty ?? false);
const displayName = computed(() => props.node.name.replace(/\.md$/, ''));
const folderPath = computed(() => {
  if (!props.showFolderPath) return '';
  const lastSlash = props.node.path.lastIndexOf('/');
  return lastSlash >= 0 ? props.node.path.substring(0, lastSlash) : '';
});
const paddingLeft = computed(() => `${props.depth * 16 + 8}px`);

function handleClick() {
  const lastSlash = props.node.path.lastIndexOf('/');
  setSelectedFolder(lastSlash >= 0 ? props.node.path.substring(0, lastSlash) : '');
  openTab(props.node.path, displayName.value);
}

function handleDragStart(e: DragEvent) {
  e.dataTransfer!.setData('application/x-mdump-path', props.node.path);
  e.dataTransfer!.setData('application/x-mdump-type', 'file');
  e.dataTransfer!.effectAllowed = 'move';
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault();
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  showContextMenu.value = true;
}

async function handleDelete() {
  confirm(
    'Delete Note',
    `Are you sure you want to delete "${displayName.value}"? This cannot be undone.`,
    async () => {
      try {
        await deleteFile(props.node.path);
        toast.success('Note deleted');
      } catch (error) {
        toast.error('Failed to delete note');
      }
    }
  );
}

async function handleDuplicate() {
  try {
    const newPath = await duplicateFile(props.node.path);
    toast.success('Note duplicated');
    openTab(newPath, newPath.split('/').pop()?.replace(/\.md$/, '') || 'Untitled');
  } catch (error) {
    toast.error('Failed to duplicate note');
  }
}

async function handleRename(newName: string) {
  try {
    const newPath = await renameFile(props.node.path, newName);
    updateTabPath(props.node.path, newPath, newName);
    toast.success('Note renamed');
  } catch (error) {
    toast.error('Failed to rename note');
  }
}

async function handleMove(destination: string) {
  try {
    const newPath = await moveFile(props.node.path, destination);
    const newDisplayName = newPath.split('/').pop()?.replace(/\.md$/, '') || displayName.value;
    updateTabPath(props.node.path, newPath, newDisplayName);
    toast.success('Note moved');
  } catch (error) {
    toast.error('Failed to move note');
  }
}

const contextMenuItems = computed(() => [
  { label: 'Open', action: handleClick },
  { label: 'Rename', action: () => { showRenameModal.value = true; } },
  { label: 'Move', action: () => { showMoveModal.value = true; } },
  { label: 'Duplicate', action: handleDuplicate },
  { separator: true },
  { label: 'Delete', action: handleDelete, danger: true },
]);
</script>

<template>
  <!-- Grid mode card -->
  <div
    v-if="gridMode"
    class="file-grid-item"
    :class="{ active: isActive, dirty: isDirty }"
    draggable="true"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleDragStart"
  >
    <FileText class="w-10 h-10 text-base-content/60" />
    <span class="truncate w-full text-center text-xs">{{ displayName }}</span>
  </div>

  <!-- Tree / List mode -->
  <div
    v-else
    class="file-tree-item"
    :class="{ active: isActive, dirty: isDirty }"
    :style="{ paddingLeft }"
    draggable="true"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleDragStart"
  >
    <FileText class="w-4 h-4 flex-shrink-0 text-base-content/60" />
    <span class="truncate flex-1">
      {{ displayName }}
      <span v-if="folderPath" class="text-xs text-base-content/40 ml-1">{{ folderPath }}</span>
    </span>
  </div>

  <ContextMenu
    v-model:open="showContextMenu"
    :position="contextMenuPosition"
    :items="contextMenuItems"
  />

  <RenameModal
    v-model:open="showRenameModal"
    :current-name="node.name"
    type="file"
    @renamed="handleRename"
  />

  <MoveModal
    v-model:open="showMoveModal"
    :current-path="node.path"
    type="file"
    @moved="handleMove"
  />
</template>
