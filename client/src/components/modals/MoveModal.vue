<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { X, FolderInput, Folder, Check } from 'lucide-vue-next';
import { foldersApi } from '@/api/client';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  currentPath: string;
  type: 'file' | 'folder';
}>();

const emit = defineEmits<{
  moved: [destination: string];
}>();

const folders = ref<string[]>([]);
const loadingFolders = ref(false);
const selectedFolder = ref<string>('/');

const currentParent = computed(() => {
  const parts = props.currentPath.split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') : '/';
});

const availableFolders = computed(() => {
  const all = ['/', ...folders.value];
  // Exclude current parent folder
  return all.filter(f => {
    const normalizedParent = currentParent.value === '/' ? '/' : currentParent.value;
    const normalizedFolder = f === '/' ? '/' : f;
    // For folders, also exclude the folder itself and its children
    if (props.type === 'folder') {
      if (normalizedFolder === props.currentPath) return false;
      if (normalizedFolder.startsWith(props.currentPath + '/')) return false;
    }
    return normalizedFolder !== normalizedParent;
  });
});

watch(open, async (isOpen) => {
  if (isOpen) {
    selectedFolder.value = '/';
    loadingFolders.value = true;
    try {
      folders.value = await foldersApi.getAll();
    } catch {
      folders.value = [];
    } finally {
      loadingFolders.value = false;
    }
  }
});

function handleMove() {
  emit('moved', selectedFolder.value === '/' ? '' : selectedFolder.value);
  open.value = false;
}

function close() {
  open.value = false;
}

function displayPath(path: string): string {
  return path === '/' ? '/ (Root)' : path;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal-content max-w-sm">
        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-base-300">
          <div class="p-2 rounded-full bg-primary/20">
            <FolderInput class="w-5 h-5 text-primary" />
          </div>
          <h2 class="text-lg font-semibold flex-1">Move {{ type === 'file' ? 'Note' : 'Folder' }}</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <p class="text-sm text-base-content/60 mb-3">Select destination folder:</p>

          <div v-if="loadingFolders" class="flex items-center justify-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <div v-else-if="availableFolders.length === 0" class="text-center py-4 text-base-content/40">
            <p class="text-sm">No other folders available</p>
          </div>

          <div v-else class="max-h-60 overflow-y-auto space-y-1">
            <button
              v-for="folder in availableFolders"
              :key="folder"
              class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left hover:bg-base-200 transition-colors"
              :class="{ 'bg-primary/20 text-primary': selectedFolder === folder }"
              @click="selectedFolder = folder"
            >
              <Folder class="w-4 h-4 flex-shrink-0" />
              <span class="flex-1 truncate">{{ displayPath(folder) }}</span>
              <Check v-if="selectedFolder === folder" class="w-4 h-4 flex-shrink-0" />
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="availableFolders.length === 0"
            @click="handleMove"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
