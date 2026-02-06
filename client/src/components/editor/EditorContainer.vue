<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed, nextTick, type Ref } from 'vue';
import Wysimark from '@wysimark/vue';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import type { useToast } from '@/composables/useToast';
import { uploadApi } from '@/api/client';
import Breadcrumb from './Breadcrumb.vue';
import AttachmentBar from './AttachmentBar.vue';
import { cleanMarkdown } from '@/utils/cleanMarkdown';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const props = defineProps<{
  filePath: string;
}>();

const { getFile, saveFile } = useFiles();
const { markDirty, activeTabPath } = useTabs();
const { preferences } = useSettings();
const { registerShortcut } = useKeyboard();
const toast = inject<ReturnType<typeof useToast>>('toast')!;
const externalReloadPath = inject<Ref<string | null>>('externalReloadPath')!;

// Turndown for HTML → markdown conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndown.use(gfm);

const loading = ref(true);
const saving = ref(false);
const content = ref('');
const lastSavedContent = ref('');
const editorRef = ref<InstanceType<typeof Wysimark> | null>(null);

// Auto-save timers
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

const isDirty = computed(() => cleanMarkdown(content.value) !== lastSavedContent.value);

// Load file content
async function loadFile() {
  loading.value = true;
  try {
    const fileContent = await getFile(props.filePath);
    content.value = fileContent.content;
    lastSavedContent.value = fileContent.content;
    nextTick(() => {
      editorRef.value?.setMarkdown(fileContent.content);
    });
  } catch (error) {
    toast.error('Failed to load file');
  } finally {
    loading.value = false;
  }
}

// Save file content
async function save({ silent = false } = {}) {
  if (saving.value) return;

  // Get latest content from editor, bypassing throttle — don't write back
  // to content.value as that would trigger Wysimark to reset the cursor
  const latest = editorRef.value?.getMarkdown();
  const toSave = latest !== undefined ? cleanMarkdown(latest) : content.value;

  if (toSave === lastSavedContent.value) return;

  saving.value = true;
  try {
    await saveFile(props.filePath, toSave);
    lastSavedContent.value = toSave;
    markDirty(props.filePath, false);
    if (!silent) toast.success('Saved');
  } catch (error) {
    toast.error('Failed to save');
  } finally {
    saving.value = false;
  }
}

// Watch content changes (Wysimark only emits update:modelValue, not change)
watch(content, (value) => {
  const dirty = cleanMarkdown(value) !== lastSavedContent.value;
  markDirty(props.filePath, dirty);

  // Schedule auto-save
  if (preferences.value.autoSave.enabled && dirty) {
    scheduleAutoSave();
  }
});

// Schedule debounced auto-save
function scheduleAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  autoSaveTimeout = setTimeout(() => {
    if (isDirty.value) {
      save({ silent: true });
    }
  }, preferences.value.autoSave.debounceMs);
}

// Handle paste (images and rich HTML)
async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  // Check for image paste first
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;

      try {
        const result = await uploadApi.upload(props.filePath, file);
        const currentMarkdown = editorRef.value?.getMarkdown() || '';
        const imageMarkdown = `\n![${result.filename}](${result.url})\n`;
        editorRef.value?.setMarkdown(currentMarkdown + imageMarkdown);
        toast.success('Image uploaded');
      } catch (error) {
        toast.error('Failed to upload image');
      }
      return;
    }
  }

  // Check for HTML paste from external sources
  const html = e.clipboardData?.getData('text/html');
  if (html) {
    // Let Wysimark/Slate handle it natively first — only intercept if it's
    // from an external source (not from within the editor itself)
    const isInternal = html.includes('data-slate-fragment');
    if (!isInternal) {
      e.preventDefault();
      const markdown = turndown.turndown(html);

      // Insert at cursor position by dispatching a plain-text paste event
      const textEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
        bubbles: true,
        cancelable: true,
      });
      textEvent.clipboardData!.setData('text/plain', markdown);

      const slateEditor = document.querySelector('[data-slate-editor]');
      if (slateEditor) {
        slateEditor.dispatchEvent(textEvent);
      } else {
        // Fallback: append to document
        const currentMarkdown = editorRef.value?.getMarkdown() || '';
        editorRef.value?.setMarkdown(currentMarkdown + '\n' + markdown);
      }
    }
  }
}

// Handle image drop
async function handleDrop(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (!files) return;

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      try {
        const result = await uploadApi.upload(props.filePath, file);
        const currentMarkdown = editorRef.value?.getMarkdown() || '';
        const imageMarkdown = `\n![${result.filename}](${result.url})\n`;
        editorRef.value?.setMarkdown(currentMarkdown + imageMarkdown);
        toast.success('Image uploaded');
      } catch (error) {
        toast.error('Failed to upload image');
      }
    }
  }
}

let unsubscribeShortcut: (() => void) | null = null;

onMounted(async () => {
  await loadFile();

  // Register Ctrl+S shortcut
  unsubscribeShortcut = registerShortcut('ctrl+s', () => {
    if (activeTabPath.value === props.filePath) {
      save();
    }
  });

});

onUnmounted(() => {
  if (unsubscribeShortcut) {
    unsubscribeShortcut();
  }

  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Save on unmount if dirty
  if (isDirty.value) {
    save({ silent: true });
  }
});

// Watch for external file changes
watch(externalReloadPath, (path) => {
  if (path === props.filePath) {
    loadFile();
    externalReloadPath.value = null;
  }
});
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Breadcrumb -->
    <Breadcrumb :path="filePath" :saving="saving" />

    <!-- Attachment bar -->
    <AttachmentBar :file-path="filePath" />

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Editor -->
    <div v-else class="editor-wrap flex-1 min-h-0" @paste="handlePaste" @drop.prevent="handleDrop" @dragover.prevent>
      <Wysimark
        ref="editorRef"
        v-model="content"
        placeholder="Start writing..."
      />
    </div>
  </div>
</template>

<style>
/* Wysimark uses Emotion CSS-in-JS with auto-generated classes,
   so we target its DOM structure directly */
.editor-wrap {
  display: flex;
  flex-direction: column;
}
/* Vue wrapper div */
.editor-wrap > div {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
/* Wysimark outer container (Emotion sets overflow-y: clip which prevents scrolling) */
.editor-wrap > div > div {
  flex: 1;
  min-height: 0;
  overflow-y: hidden !important;
  color: inherit !important;
}
/* Slate editor area */
.editor-wrap [data-slate-editor] {
  flex: 1;
  overflow-y: auto !important;
  min-height: 0;
}
</style>
