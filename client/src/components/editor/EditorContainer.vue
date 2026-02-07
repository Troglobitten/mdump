<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed, nextTick, type Ref } from 'vue';
import Wysimark from '@wysimark/vue';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import { useToolbarButtons } from '@/composables/useToolbarButtons';
import type { useToast } from '@/composables/useToast';
import { uploadApi } from '@/api/client';
import Breadcrumb from './Breadcrumb.vue';
import AttachmentBar from './AttachmentBar.vue';
import PasteMarkdownModal from '@/components/modals/PasteMarkdownModal.vue';
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
const editorWrapRef = ref<HTMLElement | null>(null);
const attachmentBarRef = ref<InstanceType<typeof AttachmentBar> | null>(null);
const imageInputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const pasteModalOpen = ref(false);

// MutationObserver for rewriting img src to include resize params
let imgObserver: MutationObserver | null = null;
let imgObserverTimeout: ReturnType<typeof setTimeout> | null = null;

function processImages() {
  if (!editorWrapRef.value) return;
  const imgs = editorWrapRef.value.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src || !src.startsWith('/api/files/')) continue;

    // Read dimensions from HTML attributes (Wysimark sets these, not inline styles)
    const attrWidth = img.getAttribute('width');
    const attrHeight = img.getAttribute('height');
    if (!attrWidth || !attrHeight) continue;

    const w = Math.round(parseInt(attrWidth, 10) / 10) * 10;
    const h = Math.round(parseInt(attrHeight, 10) / 10) * 10;
    if (w <= 0 || h <= 0) continue;

    // Build the expected src with resize params
    const baseSrc = src.split('?')[0];
    const expectedSrc = `${baseSrc}?w=${w}&h=${h}`;

    // Only modify if not already set to the right value
    if (src !== expectedSrc) {
      img.setAttribute('src', expectedSrc);
    }
  }
}

function scheduleProcessImages() {
  if (imgObserverTimeout) clearTimeout(imgObserverTimeout);
  imgObserverTimeout = setTimeout(processImages, 300);
}

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
        let url = result.url;
        if (result.width && result.height) {
          url = `${url}#srcSize=${result.width}x${result.height}&size=${result.width}x${result.height}`;
        }
        const currentMarkdown = editorRef.value?.getMarkdown() || '';
        const imageMarkdown = `\n![${result.filename}](${url})\n`;
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
        let url = result.url;
        if (result.width && result.height) {
          url = `${url}#srcSize=${result.width}x${result.height}&size=${result.width}x${result.height}`;
        }
        const currentMarkdown = editorRef.value?.getMarkdown() || '';
        const imageMarkdown = `\n![${result.filename}](${url})\n`;
        editorRef.value?.setMarkdown(currentMarkdown + imageMarkdown);
        toast.success('Image uploaded');
      } catch (error) {
        toast.error('Failed to upload image');
      }
    }
  }
}

// Custom toolbar buttons
const { registerButton } = useToolbarButtons(editorWrapRef);

const PASTE_MD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2"/><path d="M11 14h10"/><path d="m17 10 4 4-4 4"/></svg>`;

registerButton({
  id: 'paste-markdown',
  title: 'Paste as Markdown',
  icon: PASTE_MD_ICON,
  onClick: () => { pasteModalOpen.value = true; },
});

function handlePasteMarkdown(text: string) {
  const slateEditor = editorWrapRef.value?.querySelector('[data-slate-editor]') as HTMLElement | null;
  if (!slateEditor) return;

  slateEditor.focus();
  const textEvent = new ClipboardEvent('paste', {
    clipboardData: new DataTransfer(),
    bubbles: true,
    cancelable: true,
  });
  textEvent.clipboardData!.setData('text/plain', text);
  slateEditor.dispatchEvent(textEvent);
}

// Insert markdown at cursor (if editor has focus) or append at bottom
function insertMarkdownAtCursorOrBottom(text: string) {
  const slateEditor = editorWrapRef.value?.querySelector('[data-slate-editor]') as HTMLElement | null;
  if (slateEditor && document.activeElement === slateEditor) {
    const textEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    });
    textEvent.clipboardData!.setData('text/plain', text);
    slateEditor.dispatchEvent(textEvent);
  } else {
    const currentMarkdown = editorRef.value?.getMarkdown() || '';
    editorRef.value?.setMarkdown(currentMarkdown + '\n' + text);
  }
}

async function handleImageUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const result = await uploadApi.upload(props.filePath, file);
    let url = result.url;
    if (result.width && result.height) {
      url = `${url}#srcSize=${result.width}x${result.height}&size=${result.width}x${result.height}`;
    }
    insertMarkdownAtCursorOrBottom(`![${result.filename}](${url})`);
    attachmentBarRef.value?.loadAttachments();
    toast.success('Image inserted');
  } catch {
    toast.error('Failed to upload image');
  } finally {
    input.value = '';
  }
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const result = await uploadApi.upload(props.filePath, file);
    insertMarkdownAtCursorOrBottom(`[${result.filename}](${result.url})`);
    attachmentBarRef.value?.loadAttachments();
    toast.success('File attached');
  } catch {
    toast.error('Failed to upload file');
  } finally {
    input.value = '';
  }
}

const IMAGE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
const PAPERCLIP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

registerButton({
  id: 'insert-image',
  title: 'Insert Image',
  icon: IMAGE_ICON,
  onClick: () => { imageInputRef.value?.click(); },
});

registerButton({
  id: 'attach-file',
  title: 'Attach File',
  icon: PAPERCLIP_ICON,
  onClick: () => { fileInputRef.value?.click(); },
});

let unsubscribeShortcut: (() => void) | null = null;

onMounted(async () => {
  await loadFile();

  // Register Ctrl+S shortcut
  unsubscribeShortcut = registerShortcut('ctrl+s', () => {
    if (activeTabPath.value === props.filePath) {
      save();
    }
  });

  // Set up MutationObserver for image resize src rewriting
  nextTick(() => {
    if (editorWrapRef.value) {
      imgObserver = new MutationObserver(scheduleProcessImages);
      imgObserver.observe(editorWrapRef.value, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'width', 'height'],
      });
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

  if (imgObserver) {
    imgObserver.disconnect();
    imgObserver = null;
  }

  if (imgObserverTimeout) {
    clearTimeout(imgObserverTimeout);
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
    <AttachmentBar ref="attachmentBarRef" :file-path="filePath" />

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Editor -->
    <div v-else ref="editorWrapRef" class="editor-wrap flex-1 min-h-0" @paste="handlePaste" @drop.prevent="handleDrop" @dragover.prevent>
      <Wysimark
        ref="editorRef"
        v-model="content"
        placeholder="Start writing..."
      />
    </div>

    <!-- Hidden file inputs for toolbar buttons -->
    <input ref="imageInputRef" type="file" class="hidden" accept="image/*" @change="handleImageUpload" />
    <input ref="fileInputRef" type="file" class="hidden" @change="handleFileUpload" />

    <!-- Paste as markdown modal -->
    <PasteMarkdownModal v-model:open="pasteModalOpen" @submit="handlePasteMarkdown" />
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
/* Wysimark toolbar wrapper (Mx) — override overflow:hidden so
   custom toolbar buttons injected at the end are visible */
.editor-wrap > div > div > div:first-child {
  overflow: visible !important;
}
/* Slate editor area */
.editor-wrap [data-slate-editor] {
  flex: 1;
  overflow-y: auto !important;
  min-height: 0;
}
</style>
