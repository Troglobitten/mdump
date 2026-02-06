<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { X, FileText } from 'lucide-vue-next';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import type { useToast } from '@/composables/useToast';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  folderPath?: string;
}>();

const { createFile, expandToFile } = useFiles();
const { openTab } = useTabs();
const toast = inject<ReturnType<typeof useToast>>('toast')!;

const noteName = ref('');
const creating = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    noteName.value = '';
    setTimeout(() => inputRef.value?.focus(), 100);
  }
});

async function handleCreate() {
  const name = noteName.value.trim();
  if (!name) {
    toast.warning('Please enter a note name');
    return;
  }

  creating.value = true;
  try {
    const path = props.folderPath ? `${props.folderPath}/${name}` : name;
    const file = await createFile(path, '');

    // Expand tree to show new file
    expandToFile(file.path);

    // Open the new file
    openTab(file.path, name);

    toast.success('Note created');
    open.value = false;
  } catch (error) {
    toast.error('Failed to create note');
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
            <FileText class="w-5 h-5 text-primary" />
          </div>
          <h2 class="text-lg font-semibold flex-1">New Note</h2>
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
              <span class="label-text">Note name</span>
            </label>
            <input
              ref="inputRef"
              v-model="noteName"
              type="text"
              placeholder="Enter note name"
              class="input input-bordered w-full"
              @keydown="handleKeydown"
            />
            <label class="label">
              <span class="label-text-alt">.md extension will be added automatically</span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="creating || !noteName.trim()"
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
