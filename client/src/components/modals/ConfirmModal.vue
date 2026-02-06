<script setup lang="ts">
import { AlertTriangle, X } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { default: false });

defineProps<{
  title: string;
  message: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function handleConfirm() {
  emit('confirm');
  open.value = false;
}

function handleCancel() {
  emit('cancel');
  open.value = false;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="handleCancel">
      <div class="modal-content max-w-sm">
        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-base-300">
          <div class="p-2 rounded-full bg-warning/20">
            <AlertTriangle class="w-5 h-5 text-warning" />
          </div>
          <h2 class="text-lg font-semibold flex-1">{{ title }}</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="handleCancel">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <p class="text-base-content/80">{{ message }}</p>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="handleCancel">Cancel</button>
          <button class="btn btn-error" @click="handleConfirm">Confirm</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
