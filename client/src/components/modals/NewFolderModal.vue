<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { X, FolderPlus } from 'lucide-vue-next';
import { useFiles } from '@/composables/useFiles';
import type { useToast } from '@/composables/useToast';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  folderPath?: string;
}>();

const { createFolder } = useFiles();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const folderName = ref('');
const creating = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    folderName.value = '';
    setTimeout(() => inputRef.value?.focus(), 100);
  }
});

async function handleCreate() {
  const name = folderName.value.trim();
  if (!name) {
    toast.warning('Please enter a folder name');
    return;
  }

  creating.value = true;
  try {
    const path = props.folderPath ? `${props.folderPath}/${name}` : name;
    await createFolder(path);
    toast.success('Folder created');
    open.value = false;
  } catch (error) {
    toast.error('Failed to create folder');
  } finally {
    creating.value = false;
  }
}

function close() {
  open.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleCreate();
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal-content max-w-sm">
        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-base-300">
          <div class="p-2 rounded-full bg-primary/20">
            <FolderPlus class="w-5 h-5 text-primary" />
          </div>
          <h2 class="text-lg font-semibold flex-1">New Folder</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <div v-if="folderPath" class="text-sm text-base-content/60 mb-2">
            Creating in: {{ folderPath }}
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Folder name</span>
            </label>
            <input
              ref="inputRef"
              v-model="folderName"
              type="text"
              placeholder="Enter folder name"
              class="input input-bordered w-full"
              @keydown="handleKeydown"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="creating || !folderName.trim()"
            @click="handleCreate"
          >
            <span v-if="creating" class="loading loading-spinner loading-sm"></span>
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
