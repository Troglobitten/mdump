<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, Pencil } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  currentName: string;
  type: 'file' | 'folder';
}>();

const emit = defineEmits<{
  renamed: [newName: string];
}>();

const newName = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    // Strip .md extension for files
    newName.value = props.type === 'file'
      ? props.currentName.replace(/\.md$/, '')
      : props.currentName;
    setTimeout(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    }, 100);
  }
});

function handleRename() {
  const name = newName.value.trim();
  if (!name) return;
  emit('renamed', name);
  open.value = false;
}

function close() {
  open.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleRename();
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
            <Pencil class="w-5 h-5 text-primary" />
          </div>
          <h2 class="text-lg font-semibold flex-1">Rename {{ type === 'file' ? 'Note' : 'Folder' }}</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">New name</span>
            </label>
            <input
              ref="inputRef"
              v-model="newName"
              type="text"
              placeholder="Enter new name"
              class="input input-bordered w-full"
              @keydown="handleKeydown"
            />
            <label v-if="type === 'file'" class="label">
              <span class="label-text-alt">.md extension will be added automatically</span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="!newName.trim()"
            @click="handleRename"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
