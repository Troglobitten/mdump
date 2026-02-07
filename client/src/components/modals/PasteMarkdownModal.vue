<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, ClipboardPaste } from 'lucide-vue-next';

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{
  submit: [markdown: string];
}>();

const markdown = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    markdown.value = '';
    setTimeout(() => textareaRef.value?.focus(), 100);
  }
});

function handleSubmit() {
  const text = markdown.value.trim();
  if (!text) return;
  emit('submit', text);
  open.value = false;
}

function close() {
  open.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    handleSubmit();
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="close">
      <div class="modal-content max-w-lg">
        <!-- Header -->
        <div class="flex items-center gap-3 p-4 border-b border-base-300">
          <div class="p-2 rounded-full bg-primary/20">
            <ClipboardPaste class="w-5 h-5 text-primary" />
          </div>
          <h2 class="text-lg font-semibold flex-1">Paste Markdown</h2>
          <button class="btn btn-ghost btn-sm btn-square" @click="close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Paste raw markdown below</span>
            </label>
            <textarea
              ref="textareaRef"
              v-model="markdown"
              placeholder="# Heading&#10;&#10;Some **bold** text..."
              class="textarea textarea-bordered w-full h-48 font-mono text-sm"
              @keydown="handleKeydown"
            />
            <label class="label">
              <span class="label-text-alt">Ctrl+Enter to submit</span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 p-4 border-t border-base-300">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="!markdown.trim()"
            @click="handleSubmit"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
