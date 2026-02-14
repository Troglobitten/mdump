<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed, nextTick, type Ref } from 'vue';
import { Crepe } from '@milkdown/crepe';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import { useDebug } from '@/composables/useDebug';
import type { useToast } from '@/composables/useToast';
import Breadcrumb from './Breadcrumb.vue';
import AttachmentBar from './AttachmentBar.vue';
import PasteMarkdownModal from '@/components/modals/PasteMarkdownModal.vue';

const props = defineProps<{
  filePath: string;
}>();

const { getFile, saveFile } = useFiles();
const { markDirty, activeTabPath } = useTabs();
const { preferences } = useSettings();
const { registerShortcut } = useKeyboard();
const debug = useDebug('EditorContainer');
const toast = inject<ReturnType<typeof useToast>>('toast')!;
const externalReloadPath = inject<Ref<string | null>>('externalReloadPath')!;

const loading = ref(true);
const saving = ref(false);
const content = ref('');
const lastSavedContent = ref('');
const editorEl = ref<HTMLDivElement | null>(null);
const attachmentBarRef = ref<InstanceType<typeof AttachmentBar> | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const pasteModalOpen = ref(false);

// Milkdown Crepe instance
let crepe: Crepe | null = null;

// Auto-save timers
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

const isDirty = computed(() => content.value !== lastSavedContent.value);

// Load file content
async function loadFile() {
  loading.value = true;
  debug.log('loadFile called', props.filePath);

  try {
    const fileContent = await getFile(props.filePath);
    content.value = fileContent.content;
    lastSavedContent.value = fileContent.content;
    debug.log('File loaded, content length:', content.value.length);

    // Destroy and recreate editor with new content
    if (crepe) {
      debug.log('Destroying existing editor');
      crepe.destroy();
      crepe = null;
    }

    // Set loading to false so the editor div renders
    loading.value = false;

    // Wait for Vue to render the editor div
    await nextTick();

    if (editorEl.value) {
      debug.log('editorEl exists, creating editor');
      await createEditor();
    } else {
      debug.error('editorEl is null after nextTick!');
    }
  } catch (error) {
    debug.error('Load failed:', error);
    toast.error('Failed to load file');
    loading.value = false;
  }
}

// Create Milkdown Crepe editor
async function createEditor() {
  debug.log('createEditor called');
  if (!editorEl.value) {
    debug.error('editorEl is null in createEditor');
    return;
  }

  debug.log('Creating Crepe instance with content length:', content.value.length);
  try {
    crepe = new Crepe({
      root: editorEl.value,
      defaultValue: content.value || '# Welcome\n\nStart writing...',
    });

    debug.time('Crepe initialization');
    await crepe.create();
    debug.timeEnd('Crepe initialization');
    debug.log('Crepe created successfully');

    // Listen to markdown updates for dirty detection and auto-save
    crepe.on((ctx) => {
      ctx.updated(() => {
        if (crepe) {
          const md = crepe.getMarkdown();
          const wasClean = !isDirty.value;
          content.value = md;
          const dirty = md !== lastSavedContent.value;
          markDirty(props.filePath, dirty);

          // Log state transitions
          if (wasClean && dirty) {
            debug.log('Document became dirty, length:', md.length);
          }

          // Schedule auto-save
          if (preferences.value.autoSave.enabled && dirty) {
            debug.log('Scheduling auto-save (debounce:', preferences.value.autoSave.debounceMs + 'ms)');
            scheduleAutoSave();
          }
        }
      });
    });
    debug.log('Event listener attached');
  } catch (error) {
    debug.error('Error creating editor:', error);
  }
}

// Get current markdown content
function getEditorContent(): string {
  if (!crepe) return content.value;
  return crepe.getMarkdown();
}

// Save file content
async function save({ silent = false } = {}) {
  if (saving.value) {
    debug.warn('Save already in progress, skipping');
    return;
  }

  const toSave = getEditorContent();

  if (toSave === lastSavedContent.value) {
    debug.log('No changes to save');
    return;
  }

  saving.value = true;
  debug.log('Saving file, content length:', toSave.length, 'silent:', silent);

  try {
    debug.time('File save');
    await saveFile(props.filePath, toSave);
    debug.timeEnd('File save');

    lastSavedContent.value = toSave;
    markDirty(props.filePath, false);
    debug.log('Save successful');
    if (!silent) toast.success('Saved');
  } catch (error) {
    debug.error('Save failed:', error);
    toast.error('Failed to save');
  } finally {
    saving.value = false;
  }
}

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

// Placeholder handlers for deferred features
// These will be implemented in a later phase
async function handleImageUpload(e: Event) {
  toast.error('Image upload not yet implemented');
  const input = e.target as HTMLInputElement;
  input.value = '';
}

async function handleFileUpload(e: Event) {
  toast.error('File attachment not yet implemented');
  const input = e.target as HTMLInputElement;
  input.value = '';
}

function handlePasteMarkdown(_text: string) {
  toast.error('Paste markdown not yet implemented');
}

let unsubscribeShortcut: (() => void) | null = null;

onMounted(async () => {
  debug.log('Component mounted for file:', props.filePath);
  await loadFile();

  // Register Ctrl+S shortcut
  unsubscribeShortcut = registerShortcut('ctrl+s', () => {
    if (activeTabPath.value === props.filePath) {
      debug.log('Ctrl+S pressed, triggering save');
      save();
    }
  });
  debug.log('Keyboard shortcuts registered');
});

onUnmounted(() => {
  debug.log('Component unmounting');

  if (unsubscribeShortcut) {
    unsubscribeShortcut();
    debug.log('Keyboard shortcuts unregistered');
  }

  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    debug.log('Auto-save timer cleared');
  }

  // Destroy Crepe instance
  if (crepe) {
    debug.log('Destroying Crepe instance');
    crepe.destroy();
    crepe = null;
  }

  // Save on unmount if dirty
  if (isDirty.value) {
    debug.log('Saving dirty changes on unmount');
    save({ silent: true });
  }
});

// Watch for external file changes
watch(externalReloadPath, (path) => {
  if (path === props.filePath) {
    debug.log('External file change detected, reloading');
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
    <AttachmentBar ref="attachmentBarRef" :file-path="filePath" />

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Editor -->
    <div v-else ref="editorEl" class="editor-wrap flex-1 min-h-0"></div>

    <!-- Hidden file inputs for toolbar buttons (not yet hooked up) -->
    <input ref="imageInputRef" type="file" class="hidden" accept="image/*" @change="handleImageUpload" />
    <input ref="fileInputRef" type="file" class="hidden" @change="handleFileUpload" />

    <!-- Paste as markdown modal (not yet hooked up) -->
    <PasteMarkdownModal v-model:open="pasteModalOpen" @submit="handlePasteMarkdown" />
  </div>
</template>
