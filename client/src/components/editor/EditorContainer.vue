<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed, nextTick, type Ref } from 'vue';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/core';
import { toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, turnIntoTextCommand, wrapInBulletListCommand, wrapInOrderedListCommand, liftListItemCommand, wrapInBlockquoteCommand, createCodeBlockCommand, insertHrCommand } from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { $command, $mark, $remark } from '@milkdown/utils';
import { toggleMark } from 'prosemirror-commands';
import { lift } from 'prosemirror-commands';
import type { Editor } from '@milkdown/kit/core';
import { visit } from 'unist-util-visit';
import { Bold, Italic, Strikethrough, Code, Quote, Minus, Type, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, ChevronDown, List, ListOrdered, ListTodo, Superscript, Subscript } from 'lucide-vue-next';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import { useDebug } from '@/composables/useDebug';
import type { useToast } from '@/composables/useToast';
import Breadcrumb from './Breadcrumb.vue';
import AttachmentBar from './AttachmentBar.vue';
import PasteMarkdownModal from '@/components/modals/PasteMarkdownModal.vue';

// Remark plugin to transform <sup> and <sub> HTML into mark nodes
const remarkSuperSubPlugin = $remark('remarkSuperSub', () => () => (tree: any) => {
  visit(tree, (node, index, parent) => {
    if (node.type === 'html' && (node.value === '<sup>' || node.value === '<sub>')) {
      const markType = node.value === '<sup>' ? 'superscript' : 'subscript';
      const closingTag = node.value === '<sup>' ? '</sup>' : '</sub>';

      // Find the closing tag
      const siblings = parent?.children || [];
      const startIndex = index!;
      let endIndex = -1;

      for (let i = startIndex + 1; i < siblings.length; i++) {
        if (siblings[i].type === 'html' && siblings[i].value === closingTag) {
          endIndex = i;
          break;
        }
      }

      if (endIndex !== -1 && parent) {
        // Collect children between opening and closing tags
        const children = siblings.slice(startIndex + 1, endIndex);

        // Create a new mark node
        const markNode = {
          type: markType,
          children: children
        };

        // Replace the HTML nodes with the mark node
        parent.children.splice(startIndex, endIndex - startIndex + 1, markNode);

        // Return index to re-visit this position
        return startIndex;
      }
    }
  });
});

// Define superscript mark
const superscriptMark = $mark('superscript', () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', 0],
  parseMarkdown: {
    match: (node) => node.type === 'superscript',
    runner: (state, node, type) => {
      state.openMark(type);
      state.next(node.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'superscript',
    runner: (state, mark) => {
      state.withMark(mark, 'superscript');
    },
  },
}));

// Define subscript mark
const subscriptMark = $mark('subscript', () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', 0],
  parseMarkdown: {
    match: (node) => node.type === 'subscript',
    runner: (state, node, type) => {
      state.openMark(type);
      state.next(node.children);
      state.closeMark(type);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'subscript',
    runner: (state, mark) => {
      state.withMark(mark, 'subscript');
    },
  },
}));

// Define toggle commands
const toggleSuperscriptCommand = $command('ToggleSuperscript', (ctx) => () => {
  return toggleMark(superscriptMark.type(ctx));
});

const toggleSubscriptCommand = $command('ToggleSubscript', (ctx) => () => {
  return toggleMark(subscriptMark.type(ctx));
});

// Custom feature to add superscript and subscript support
const superSubFeature = (editor: Editor) => {
  // Add remark plugin to parse HTML tags into mark nodes
  editor.use(remarkSuperSubPlugin);

  // Add marks and commands
  editor.use(superscriptMark);
  editor.use(subscriptMark);
  editor.use(toggleSuperscriptCommand);
  editor.use(toggleSubscriptCommand);

  // Add custom remark stringify handlers for HTML serialization
  editor.config((ctx) => {
    const options = ctx.get(remarkStringifyOptionsCtx);

    // Handler for superscript - wraps content in <sup> tags
    options.handlers.superscript = (node: any, _: any, state: any, info: any) => {
      const exit = state.enter('superscript');
      const tracker = state.createTracker(info);
      let value = tracker.move('<sup>');
      value += tracker.move(
        state.containerPhrasing(node, {
          before: value,
          after: '</sup>',
          ...tracker.current()
        })
      );
      value += tracker.move('</sup>');
      exit();
      return value;
    };

    // Handler for subscript - wraps content in <sub> tags
    options.handlers.subscript = (node: any, _: any, state: any, info: any) => {
      const exit = state.enter('subscript');
      const tracker = state.createTracker(info);
      let value = tracker.move('<sub>');
      value += tracker.move(
        state.containerPhrasing(node, {
          before: value,
          after: '</sub>',
          ...tracker.current()
        })
      );
      value += tracker.move('</sub>');
      exit();
      return value;
    };

    ctx.set(remarkStringifyOptionsCtx, options);
  });
};

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
const blockStyleDropdownRef = ref<HTMLDivElement | null>(null);
const listDropdownRef = ref<HTMLDivElement | null>(null);

// Milkdown Crepe instance
let crepe: Crepe | null = null;

// Auto-save timers
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

// Toolbar state
const isBoldActive = ref(false);
const isItalicActive = ref(false);
const isStrikethroughActive = ref(false);
const isSuperscriptActive = ref(false);
const isSubscriptActive = ref(false);
const isCodeBlockActive = ref(false);
const isBlockquoteActive = ref(false);
const currentBlockType = ref<'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>('paragraph');
const blockStyleDropdownOpen = ref(false);
const currentListType = ref<'none' | 'bullet' | 'ordered' | 'task'>('none');
const listDropdownOpen = ref(false);

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
      features: {
        [CrepeFeature.Latex]: false,
      },
    });

    // Add custom superscript/subscript feature before creating
    crepe.addFeature(superSubFeature);

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

    // Add selection change listener to update toolbar state
    crepe.editor?.action((ctx) => {
      const view = ctx.get(editorViewCtx);

      // Initial state check
      updateToolbarStateFromView(view);

      // Listen to all transactions (including selection changes)
      const originalDispatch = view.dispatch.bind(view);
      view.dispatch = (tr) => {
        originalDispatch(tr);
        updateToolbarStateFromView(view);
      };
    });
  } catch (error) {
    debug.error('Error creating editor:', error);
  }
}

// Get current markdown content
function getEditorContent(): string {
  if (!crepe) return content.value;
  return crepe.getMarkdown();
}

// Update toolbar button states from editor view
function updateToolbarStateFromView(view: any) {
  try {
    const { state } = view;
    const { from, to, empty } = state.selection;
    const strongMark = state.schema.marks.strong;
    const emMark = state.schema.marks.em || state.schema.marks.emphasis;
    const strikeMark = state.schema.marks.strike_through;
    const superscriptMarkType = state.schema.marks.superscript;
    const subscriptMarkType = state.schema.marks.subscript;

    // Helper to check if a mark is active
    const isMarkActive = (mark: any) => {
      if (!mark) return false;
      if (empty) {
        const marks = state.storedMarks || state.selection.$from.marks();
        return mark.isInSet(marks) !== undefined;
      } else {
        return state.doc.rangeHasMark(from, to, mark);
      }
    };

    // Check marks
    isBoldActive.value = isMarkActive(strongMark);
    isItalicActive.value = isMarkActive(emMark);
    isStrikethroughActive.value = isMarkActive(strikeMark);
    isSuperscriptActive.value = isMarkActive(superscriptMarkType);
    isSubscriptActive.value = isMarkActive(subscriptMarkType);

    // Check block type (paragraph vs headings vs others)
    const $from = state.selection.$from;
    const parent = $from.parent;

    if (parent.type.name === 'heading') {
      const level = parent.attrs.level;
      currentBlockType.value = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    } else if (parent.type.name === 'paragraph') {
      currentBlockType.value = 'paragraph';
    }

    // Check if in code block or blockquote
    isCodeBlockActive.value = parent.type.name === 'code_block';

    // Check for blockquote and list type in one loop
    let depth = $from.depth;
    let inBlockquote = false;
    let listType: 'none' | 'bullet' | 'ordered' | 'task' = 'none';
    let isTaskList = false;

    while (depth > 0) {
      const node = $from.node(depth);

      if (node.type.name === 'blockquote') {
        inBlockquote = true;
      }

      // Check if we're in a list_item and if it's a task list item
      if (node.type.name === 'list_item') {
        const checked = node.attrs.checked;
        if (checked !== null && checked !== undefined) {
          isTaskList = true;
        }
      }

      if (node.type.name === 'bullet_list') {
        listType = isTaskList ? 'task' : 'bullet';
      } else if (node.type.name === 'ordered_list') {
        listType = 'ordered';
      }

      depth--;
    }

    isBlockquoteActive.value = inBlockquote;
    currentListType.value = listType;
  } catch (error) {
    // Silently fail if we can't get the state
    debug.error('Failed to update toolbar state:', error);
  }
}

// Toolbar actions
function toggleBold() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleStrongCommand.key);
  });
}

function toggleItalic() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleEmphasisCommand.key);
  });
}

function toggleStrikethrough() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleStrikethroughCommand.key);
  });
}

function toggleSuperscript() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleSuperscriptCommand.key);
  });
}

function toggleSubscript() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleSubscriptCommand.key);
  });
}

function toggleCodeBlock() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);

    // If already in code block, toggle it off (convert to paragraph)
    if (isCodeBlockActive.value) {
      commandManager.call(turnIntoTextCommand.key);
    } else {
      commandManager.call(createCodeBlockCommand.key);
    }
  });
}

function toggleBlockquote() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);

    // If already in blockquote, lift it out
    if (isBlockquoteActive.value) {
      const view = ctx.get(editorViewCtx);
      // Use ProseMirror's lift command
      lift(view.state, view.dispatch);
    } else {
      commandManager.call(wrapInBlockquoteCommand.key);
    }
  });
}

function insertHorizontalRule() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(insertHrCommand.key);
  });
}

function setBlockType(type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  if (!crepe) return;

  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);

    if (type === 'paragraph') {
      commandManager.call(turnIntoTextCommand.key);
    } else {
      const level = parseInt(type.substring(1));
      commandManager.call(wrapInHeadingCommand.key, level);
    }
  });

  blockStyleDropdownOpen.value = false;
}

const blockTypeIcons = {
  paragraph: Type,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
};

const blockTypeLabels = {
  paragraph: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
};

function toggleList(type: 'bullet' | 'ordered' | 'task') {
  if (!crepe) return;

  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);

    // Handle task list separately as it requires attribute manipulation
    if (type === 'task') {
      // If already in a task list, lift out to regular text
      if (currentListType.value === 'task') {
        commandManager.call(liftListItemCommand.key);
      } else {
        // If in a different list type, lift out first
        if (currentListType.value !== 'none') {
          commandManager.call(liftListItemCommand.key);
        }

        // Wrap in bullet list
        commandManager.call(wrapInBulletListCommand.key);

        // Then set checked attribute to false
        setTimeout(() => {
          const { state, dispatch } = view;
          const { $from } = state.selection;
          let depth = $from.depth;
          while (depth > 0) {
            const node = $from.node(depth);
            if (node.type.name === 'list_item') {
              const pos = $from.before(depth);
              const tr = state.tr.setNodeMarkup(pos, null, { ...node.attrs, checked: false });
              dispatch(tr);
              return;
            }
            depth--;
          }
        }, 0);
      }
    } else {
      // Regular bullet/ordered list toggle
      if ((type === 'bullet' && currentListType.value === 'bullet') ||
          (type === 'ordered' && currentListType.value === 'ordered')) {
        commandManager.call(liftListItemCommand.key);
      } else {
        // If in a different list type, first lift out then wrap in new type
        if (currentListType.value !== 'none') {
          commandManager.call(liftListItemCommand.key);
        }

        // Wrap in the new list type
        if (type === 'bullet') {
          commandManager.call(wrapInBulletListCommand.key);
        } else if (type === 'ordered') {
          commandManager.call(wrapInOrderedListCommand.key);
        }
      }
    }
  });

  listDropdownOpen.value = false;
}

const listTypeIcons = {
  none: List,
  bullet: List,
  ordered: ListOrdered,
  task: ListTodo,
};

const listTypeLabels = {
  bullet: 'Bullet List',
  ordered: 'Numbered List',
  task: 'Task List',
};

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

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  if (blockStyleDropdownRef.value && !blockStyleDropdownRef.value.contains(event.target as Node)) {
    blockStyleDropdownOpen.value = false;
  }
  if (listDropdownRef.value && !listDropdownRef.value.contains(event.target as Node)) {
    listDropdownOpen.value = false;
  }
}

onMounted(async () => {
  debug.log('Component mounted for file:', props.filePath);
  await loadFile();

  // Add click outside listener for dropdown
  document.addEventListener('click', handleClickOutside);

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

  // Remove click outside listener
  document.removeEventListener('click', handleClickOutside);

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

    <!-- Custom Toolbar -->
    <div v-if="!loading" class="flex items-center gap-1 py-0.5 px-3 border-b border-base-300 bg-base-200/50">
      <!-- Block Style Dropdown -->
      <div ref="blockStyleDropdownRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-1 h-8 px-2 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 hover:bg-primary/20"
          @mousedown.prevent
          @click="blockStyleDropdownOpen = !blockStyleDropdownOpen"
          title="Text style"
        >
          <component :is="blockTypeIcons[currentBlockType]" :size="16" />
          <ChevronDown :size="12" />
        </button>

        <!-- Dropdown menu -->
        <div
          v-if="blockStyleDropdownOpen"
          class="absolute top-full left-0 mt-1 py-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 min-w-[160px]"
          @mousedown.prevent
        >
          <button
            v-for="type in ['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']"
            :key="type"
            type="button"
            class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-base-content hover:bg-base-200 cursor-pointer"
            :class="{ 'bg-base-200 text-primary': currentBlockType === type }"
            @click="setBlockType(type as any)"
          >
            <component :is="blockTypeIcons[type as keyof typeof blockTypeIcons]" :size="16" />
            <span>{{ blockTypeLabels[type as keyof typeof blockTypeLabels] }}</span>
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-px h-5 bg-base-300 mx-1"></div>

      <!-- List Dropdown -->
      <div ref="listDropdownRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-1 h-8 px-2 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 hover:bg-primary/20"
          :class="{ 'bg-base-300 text-primary': currentListType !== 'none' }"
          @mousedown.prevent
          @click="listDropdownOpen = !listDropdownOpen"
          title="List"
        >
          <component :is="listTypeIcons[currentListType]" :size="16" />
          <ChevronDown :size="12" />
        </button>

        <!-- Dropdown menu -->
        <div
          v-if="listDropdownOpen"
          class="absolute top-full left-0 mt-1 py-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 min-w-[160px]"
          @mousedown.prevent
        >
          <button
            v-for="type in ['bullet', 'ordered', 'task']"
            :key="type"
            type="button"
            class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-base-content hover:bg-base-200 cursor-pointer"
            :class="{ 'bg-base-200 text-primary': currentListType === type }"
            @click="toggleList(type as any)"
          >
            <component :is="listTypeIcons[type as keyof typeof listTypeIcons]" :size="16" />
            <span>{{ listTypeLabels[type as keyof typeof listTypeLabels] }}</span>
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-px h-5 bg-base-300 mx-1"></div>

      <!-- Bold Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isBoldActive }"
        @mousedown.prevent
        @click="toggleBold"
        title="Bold (Ctrl+B)"
      >
        <Bold :size="16" />
      </button>

      <!-- Italic Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isItalicActive }"
        @mousedown.prevent
        @click="toggleItalic"
        title="Italic (Ctrl+I)"
      >
        <Italic :size="16" />
      </button>

      <!-- Strikethrough Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isStrikethroughActive }"
        @mousedown.prevent
        @click="toggleStrikethrough"
        title="Strikethrough"
      >
        <Strikethrough :size="16" />
      </button>

      <!-- Superscript Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isSuperscriptActive }"
        @mousedown.prevent
        @click="toggleSuperscript"
        title="Superscript"
      >
        <Superscript :size="16" />
      </button>

      <!-- Subscript Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isSubscriptActive }"
        @mousedown.prevent
        @click="toggleSubscript"
        title="Subscript"
      >
        <Subscript :size="16" />
      </button>

      <!-- Divider -->
      <div class="w-px h-5 bg-base-300 mx-1"></div>

      <!-- Code Block Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isCodeBlockActive }"
        @mousedown.prevent
        @click="toggleCodeBlock"
        title="Code Block"
      >
        <Code :size="16" />
      </button>

      <!-- Blockquote Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        :class="{ 'bg-base-300 text-primary': isBlockquoteActive }"
        @mousedown.prevent
        @click="toggleBlockquote"
        title="Quote"
      >
        <Quote :size="16" />
      </button>

      <!-- Horizontal Rule Button -->
      <button
        type="button"
        class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
        @mousedown.prevent
        @click="insertHorizontalRule"
        title="Horizontal Line"
      >
        <Minus :size="16" />
      </button>
    </div>

    <!-- Editor -->
    <div v-if="!loading" ref="editorEl" class="editor-wrap flex-1 min-h-0"></div>

    <!-- Hidden file inputs for toolbar buttons (not yet hooked up) -->
    <input ref="imageInputRef" type="file" class="hidden" accept="image/*" @change="handleImageUpload" />
    <input ref="fileInputRef" type="file" class="hidden" @change="handleFileUpload" />

    <!-- Paste as markdown modal (not yet hooked up) -->
    <PasteMarkdownModal v-model:open="pasteModalOpen" @submit="handlePasteMarkdown" />
  </div>
</template>
