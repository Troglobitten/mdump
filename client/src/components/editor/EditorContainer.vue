<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, inject, computed, nextTick, type Ref } from 'vue';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/core';
import { toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, turnIntoTextCommand, wrapInBulletListCommand, wrapInOrderedListCommand, liftListItemCommand, wrapInBlockquoteCommand, createCodeBlockCommand, insertHrCommand, toggleLinkCommand, clearTextInCurrentBlockCommand, addBlockTypeCommand } from '@milkdown/preset-commonmark';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import { $command, $mark, $remark } from '@milkdown/utils';
import { toggleMark } from 'prosemirror-commands';
import { lift } from 'prosemirror-commands';
import type { Editor } from '@milkdown/core';
import { visit } from 'unist-util-visit';
import { Bold, Italic, Strikethrough, Code, Quote, Minus, Type, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, ChevronDown, ChevronLeft, ChevronRight, List, ListOrdered, ListTodo, Superscript, Subscript, Highlighter, Link, Image, Printer, Columns2, Sigma } from 'lucide-vue-next';
import { splitEditing, splitEditingOptionsCtx } from '@milkdown-lab/plugin-split-editing';
import { useFiles } from '@/composables/useFiles';
import { useTabs } from '@/composables/useTabs';
import { useSettings } from '@/composables/useSettings';
import { useKeyboard } from '@/composables/useKeyboard';
import { useDebug } from '@/composables/useDebug';
import type { useToast } from '@/composables/useToast';
import { uploadApi } from '@/api/client';
import Breadcrumb from './Breadcrumb.vue';
import AttachmentBar from './AttachmentBar.vue';

// ========================================
// CUSTOM MARKS CONFIGURATION SYSTEM
// ========================================

/**
 * Configuration interface for custom markdown marks
 */
interface CustomMarkConfig {
  name: string;           // Mark name (e.g., 'superscript', 'marker')
  htmlTag: string;        // HTML tag to use (e.g., 'sup', 'mark')
  syntax: 'html' | 'delimiter';  // Markdown syntax type
  delimiter?: string;     // For delimiter syntax (e.g., '==')
  parseDOM?: any[];      // Optional custom parseDOM rules (defaults to [{ tag: htmlTag }])
  icon: any;             // Lucide icon component
  title: string;         // Button tooltip
}

/**
 * Custom marks configuration - add new marks here!
 *
 * To add a new custom mark:
 * 1. Add a config object to this array
 * 2. Import the icon from 'lucide-vue-next' at the top
 * 3. That's it! The mark, command, parser, handler, and UI button will be auto-generated
 */
const customMarkConfigs: CustomMarkConfig[] = [
  {
    name: 'superscript',
    htmlTag: 'sup',
    syntax: 'html',
    icon: Superscript,
    title: 'Superscript'
  },
  {
    name: 'subscript',
    htmlTag: 'sub',
    syntax: 'html',
    icon: Subscript,
    title: 'Subscript'
  },
  {
    name: 'marker',
    htmlTag: 'mark',
    syntax: 'delimiter',
    delimiter: '==',
    icon: Highlighter,
    title: 'Highlight',
    parseDOM: [
      { tag: 'mark' },
      { style: 'background-color', getAttrs: (value: any) => value !== '' && null }
    ]
  }
];

/**
 * Factory: Creates a Milkdown mark from config
 */
const createMarkFromConfig = (config: CustomMarkConfig) => {
  return $mark(config.name, () => ({
    parseDOM: config.parseDOM || [{ tag: config.htmlTag }],
    toDOM: () => [config.htmlTag, 0],
    parseMarkdown: {
      match: (node: any) => node.type === config.name,
      runner: (state: any, node: any, type: any) => {
        state.openMark(type);
        state.next(node.children);
        state.closeMark(type);
      },
    },
    toMarkdown: {
      match: (mark: any) => mark.type.name === config.name,
      runner: (state: any, mark: any) => {
        state.withMark(mark, config.name);
      },
    },
  }));
};

/**
 * Factory: Creates a toggle command from mark
 */
const createToggleCommand = (config: CustomMarkConfig, mark: any) => {
  const commandName = `Toggle${config.name.charAt(0).toUpperCase() + config.name.slice(1)}`;
  return $command(commandName, (ctx: any) => () => {
    return toggleMark(mark.type(ctx));
  });
};

/**
 * Factory: Creates remark stringify handler from config
 */
const createStringifyHandler = (config: CustomMarkConfig) => {
  return (node: any, _: any, state: any, info: any) => {
    const exit = state.enter(config.name);
    const tracker = state.createTracker(info);

    // Determine opening/closing syntax
    const opening = config.syntax === 'delimiter'
      ? config.delimiter!
      : `<${config.htmlTag}>`;
    const closing = config.syntax === 'delimiter'
      ? config.delimiter!
      : `</${config.htmlTag}>`;

    let value = tracker.move(opening);
    value += tracker.move(
      state.containerPhrasing(node, {
        before: value,
        after: closing,
        ...tracker.current()
      })
    );
    value += tracker.move(closing);
    exit();
    return value;
  };
};

/**
 * Remark plugin to parse custom markdown syntax into mark nodes
 */
const createCustomMarksRemarkPlugin = (configs: CustomMarkConfig[]) => {
  return $remark('remarkCustomMarks', () => () => (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Handle HTML tag syntax
      const htmlConfigs = configs.filter(c => c.syntax === 'html');
      for (const config of htmlConfigs) {
        const openTag = `<${config.htmlTag}>`;
        const closeTag = `</${config.htmlTag}>`;

        if (node.type === 'html' && node.value === openTag) {
          const siblings = parent?.children || [];
          const startIndex = index!;
          let endIndex = -1;

          // Find closing tag
          for (let i = startIndex + 1; i < siblings.length; i++) {
            if (siblings[i].type === 'html' && siblings[i].value === closeTag) {
              endIndex = i;
              break;
            }
          }

          if (endIndex !== -1 && parent) {
            // Collect children between tags
            const children = siblings.slice(startIndex + 1, endIndex);

            // Create mark node
            const markNode = {
              type: config.name,
              children: children
            };

            // Replace HTML nodes with mark node
            parent.children.splice(startIndex, endIndex - startIndex + 1, markNode);
            return startIndex;
          }
        }
      }

      // Handle delimiter syntax
      const delimiterConfigs = configs.filter(c => c.syntax === 'delimiter');
      for (const config of delimiterConfigs) {
        const delimiter = config.delimiter!;
        if (node.type === 'text' && node.value && node.value.includes(delimiter)) {
          const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`${escapedDelimiter}([^${escapedDelimiter}]+)${escapedDelimiter}`, 'g');
          const parts: any[] = [];
          let lastIndex = 0;
          let match;

          while ((match = regex.exec(node.value)) !== null) {
            // Add text before the delimiter
            if (match.index > lastIndex) {
              parts.push({
                type: 'text',
                value: node.value.substring(lastIndex, match.index)
              });
            }

            // Add the mark node
            parts.push({
              type: config.name,
              children: [{ type: 'text', value: match[1] }]
            });

            lastIndex = match.index + match[0].length;
          }

          // Add remaining text
          if (lastIndex < node.value.length) {
            parts.push({
              type: 'text',
              value: node.value.substring(lastIndex)
            });
          }

          // Replace the text node with parts if we found delimiters
          if (parts.length > 0 && parent && index !== undefined) {
            parent.children.splice(index, 1, ...parts);
            // Skip past inserted nodes to avoid revisiting
            return index + parts.length;
          }
        }
      }
    });
  });
};

/**
 * Generate marks, commands, and plugin from configurations
 */
const customMarksMap = new Map();
const customCommandsMap = new Map();

customMarkConfigs.forEach(config => {
  const mark = createMarkFromConfig(config);
  const command = createToggleCommand(config, mark);
  customMarksMap.set(config.name, mark);
  customCommandsMap.set(config.name, command);
});

const remarkCustomMarksPlugin = createCustomMarksRemarkPlugin(customMarkConfigs);

/**
 * Custom marks feature - adds all configured marks to the editor
 */
const customMarksFeature = (editor: Editor) => {
  // Add remark plugin
  editor.use(remarkCustomMarksPlugin);

  // Add all marks and commands
  customMarksMap.forEach(mark => editor.use(mark));
  customCommandsMap.forEach(command => editor.use(command));

  // Add stringify handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor.config((ctx: any) => {
    const options = ctx.get(remarkStringifyOptionsCtx);

    customMarkConfigs.forEach(config => {
      options.handlers[config.name] = createStringifyHandler(config);
    });

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
const linkModalOpen = ref(false);
const linkUrl = ref('');
const linkTitle = ref('');
const blockStyleDropdownRef = ref<HTMLDivElement | HTMLDivElement[] | null>(null);
const listDropdownRef = ref<HTMLDivElement | HTMLDivElement[] | null>(null);
const viewModeDropdownRef = ref<HTMLDivElement | null>(null);

// Toolbar scroll state
const toolbarScrollContainer = ref<HTMLDivElement | null>(null);
const showToolbarLeftArrow = ref(false);
const showToolbarRightArrow = ref(false);
let toolbarResizeObserver: ResizeObserver | null = null;

function checkToolbarOverflow() {
  const el = toolbarScrollContainer.value;
  if (!el) return;
  showToolbarLeftArrow.value = el.scrollLeft > 0;
  showToolbarRightArrow.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollToolbarLeft() {
  toolbarScrollContainer.value?.scrollBy({ left: -200, behavior: 'smooth' });
}

function scrollToolbarRight() {
  toolbarScrollContainer.value?.scrollBy({ left: 200, behavior: 'smooth' });
}

// Milkdown Crepe instance
let crepe: Crepe | null = null;

// Auto-save timers
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

// Toolbar state
const isBoldActive = ref(false);
const isItalicActive = ref(false);
const isStrikethroughActive = ref(false);
const isLinkActive = ref(false);
const isCodeBlockActive = ref(false);
const isBlockquoteActive = ref(false);
const isLatexActive = ref(false);
const currentBlockType = ref<'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>('paragraph');
const blockStyleDropdownOpen = ref(false);
const currentListType = ref<'none' | 'bullet' | 'ordered' | 'task'>('none');
const listDropdownOpen = ref(false);

// Split editing view mode: 'wysiwyg' (default), 'split', or 'source'
// Load from localStorage or default to 'wysiwyg'
const savedViewMode = localStorage.getItem('editor-view-mode') as 'wysiwyg' | 'split' | 'source' | null;
const viewMode = ref<'wysiwyg' | 'split' | 'source'>(savedViewMode || 'wysiwyg');
const viewModeDropdownOpen = ref(false);

// Save view mode to localStorage whenever it changes
watch(viewMode, (newMode) => {
  localStorage.setItem('editor-view-mode', newMode);
});

// Custom marks active state (generated from config)
const customMarksActiveState = new Map<string, Ref<boolean>>();
customMarkConfigs.forEach(config => {
  customMarksActiveState.set(config.name, ref(false));
});

// Toolbar button definitions (metadata - not user preferences)
interface ToolbarButtonDefinition {
  id: string;
  type: 'button' | 'dropdown' | 'divider';
  buttonType?: 'mark' | 'block' | 'insert' | 'custom';
  action?: string;
  icon?: any;
  title?: string;
  dropdownType?: 'block-style' | 'list';
}

const TOOLBAR_BUTTON_DEFINITIONS: ToolbarButtonDefinition[] = [
  { id: 'block-style-dropdown', type: 'dropdown', dropdownType: 'block-style' },
  { id: 'list-dropdown', type: 'dropdown', dropdownType: 'list' },
  { id: 'divider-1', type: 'divider' },
  { id: 'divider-2', type: 'divider' },
  { id: 'divider-3', type: 'divider' },
  { id: 'bold', type: 'button', buttonType: 'mark', action: 'toggleBold', icon: Bold, title: 'Bold' },
  { id: 'italic', type: 'button', buttonType: 'mark', action: 'toggleItalic', icon: Italic, title: 'Italic' },
  { id: 'strikethrough', type: 'button', buttonType: 'mark', action: 'toggleStrikethrough', icon: Strikethrough, title: 'Strikethrough' },
  { id: 'link', type: 'button', buttonType: 'mark', action: 'toggleLink', icon: Link, title: 'Link' },
  { id: 'superscript', type: 'button', buttonType: 'custom', action: 'superscript', icon: Superscript, title: 'Superscript' },
  { id: 'subscript', type: 'button', buttonType: 'custom', action: 'subscript', icon: Subscript, title: 'Subscript' },
  { id: 'marker', type: 'button', buttonType: 'custom', action: 'marker', icon: Highlighter, title: 'Highlight' },
  { id: 'latex', type: 'button', buttonType: 'insert', action: 'toggleLatex', icon: Sigma, title: 'LaTeX Formula' },
  { id: 'image', type: 'button', buttonType: 'insert', action: 'insertImage', icon: Image, title: 'Insert Image' },
  { id: 'code-block', type: 'button', buttonType: 'block', action: 'toggleCodeBlock', icon: Code, title: 'Code Block' },
  { id: 'blockquote', type: 'button', buttonType: 'block', action: 'toggleBlockquote', icon: Quote, title: 'Quote' },
  { id: 'horizontal-rule', type: 'button', buttonType: 'insert', action: 'insertHorizontalRule', icon: Minus, title: 'Horizontal Line' },
  { id: 'print', type: 'button', buttonType: 'insert', action: 'printDocument', icon: Printer, title: 'Print' },
];

// Create a lookup map for quick access
const buttonDefinitionsMap = new Map(TOOLBAR_BUTTON_DEFINITIONS.map(def => [def.id, def]));

// Action handler function - handles both built-in and custom mark actions
function handleToolbarAction(action: string) {
  // Check if it's a built-in action
  const builtInActions: Record<string, () => void> = {
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleLink,
    toggleCodeBlock,
    toggleBlockquote,
    insertHorizontalRule,
    insertImage,
    printDocument,
    toggleLatex,
  };

  if (builtInActions[action]) {
    builtInActions[action]();
  } else {
    // Assume it's a custom mark name
    toggleCustomMark(action);
  }
}

// Get active state for a button
function getButtonActiveState(item: any): boolean {
  const activeStateMap: Record<string, Ref<boolean>> = {
    toggleBold: isBoldActive,
    toggleItalic: isItalicActive,
    toggleStrikethrough: isStrikethroughActive,
    toggleLink: isLinkActive,
    toggleCodeBlock: isCodeBlockActive,
    toggleBlockquote: isBlockquoteActive,
    toggleLatex: isLatexActive,
  };

  if (activeStateMap[item.action]) {
    return activeStateMap[item.action].value;
  }

  // Check custom marks
  if (item.buttonType === 'custom' && customMarksActiveState.has(item.action)) {
    return customMarksActiveState.get(item.action)!.value;
  }

  return false;
}

// Computed toolbar items - merges button definitions with user preferences
const computedToolbarItems = computed(() => {
  const config = preferences.value.toolbarConfig;
  if (!config) return [];

  // Merge user preferences with button definitions
  return config.items
    .filter(pref => pref.visible)
    .map(pref => {
      const definition = buttonDefinitionsMap.get(pref.id);
      if (!definition) {
        debug.warn(`Unknown toolbar item: ${pref.id}`);
        return null;
      }
      return {
        ...definition,
        visible: pref.visible,
        order: pref.order,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.order - b.order);
});

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
      features: {},
      featureConfigs: {
        [CrepeFeature.ImageBlock]: {
          onUpload: async (file: File) => {
            debug.log('ImageBlock upload:', file.name, file.size);
            const result = await uploadApi.upload(props.filePath, file);
            debug.log('Image uploaded to:', result.url);
            return result.url;
          },
        },
        [CrepeFeature.Toolbar]: {
          buildToolbar: (builder: any) => {
            // Add a new group for custom marks
            const customGroup = builder.addGroup('custom', 'Custom');
            customGroup.addItem('marker', {
              icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
              active: (ctx: any) => {
                const view = ctx.get(editorViewCtx);
                const { state } = view;
                const { from, to, empty } = state.selection;
                const markerMark = state.schema.marks.marker;
                if (!markerMark) return false;
                if (empty) {
                  const marks = state.storedMarks || state.selection.$from.marks();
                  return markerMark.isInSet(marks) !== undefined;
                }
                return state.doc.rangeHasMark(from, to, markerMark);
              },
              onRun: (ctx: any) => {
                const commandManager = ctx.get(commandsCtx);
                const markerCommand = customCommandsMap.get('marker');
                if (markerCommand) {
                  commandManager.call(markerCommand.key);
                }
              }
            });
          }
        }
      },
    });

    // Add custom marks feature before creating
    crepe.addFeature(customMarksFeature);

    // Add split editing plugin with configuration
    crepe.editor
      .config((ctx) => {
        ctx.set(splitEditingOptionsCtx.key, {
          wrapperAttributes: { class: 'split-editor' },
          attributes: { class: 'milkdown-split-editor' },
          hiddenAttribute: { class: 'hidden' },
          hiddenWrapperAttributes: { class: 'single-editor' },
        });
      })
      .use(splitEditing);

    // The split-editing plugin's view() calls editorRoot.replaceChildren() to restructure
    // the DOM, which detaches ALL tooltip elements (toolbar, link preview, link edit, etc.)
    // that TooltipProvider instances already appended to .milkdown. Because TooltipProvider
    // only appends once (_initialized flag), they are never re-attached. Collect every
    // detached element that is NOT ProseMirror and re-append them all to .milkdown.
    const detachedOverlays: HTMLElement[] = [];
    const toolbarObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Only process removals whose target is .milkdown itself, not deeper nodes.
        // This avoids accidentally collecting ancestor elements.
        if (!(mutation.target instanceof HTMLElement) || !mutation.target.classList.contains('milkdown')) continue;
        for (const node of Array.from(mutation.removedNodes)) {
          if (node instanceof HTMLElement && !node.classList.contains('ProseMirror')) {
            detachedOverlays.push(node);
          }
        }
      }
    });
    toolbarObserver.observe(editorEl.value, { childList: true, subtree: true });

    debug.time('Crepe initialization');
    await crepe.create();
    debug.timeEnd('Crepe initialization');
    toolbarObserver.disconnect();
    debug.log('Crepe created successfully');

    // Re-attach all detached tooltip overlays to .milkdown
    if (detachedOverlays.length > 0) {
      const milkdownEl = editorEl.value.querySelector('.milkdown');
      if (milkdownEl) {
        detachedOverlays.forEach(el => milkdownEl.appendChild(el));
        debug.log('Re-attached overlays to .milkdown:', detachedOverlays.map(el => el.className));
      }
    }

    // Apply initial view mode immediately after next render
    requestAnimationFrame(() => {
      setViewMode(viewMode.value);
    });

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
    const linkMark = state.schema.marks.link;

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

    // Check built-in marks
    isBoldActive.value = isMarkActive(strongMark);
    isItalicActive.value = isMarkActive(emMark);
    isStrikethroughActive.value = isMarkActive(strikeMark);
    isLinkActive.value = isMarkActive(linkMark);

    // Check custom marks (dynamically generated from config)
    customMarkConfigs.forEach(config => {
      const markType = state.schema.marks[config.name];
      const activeRef = customMarksActiveState.get(config.name);
      if (activeRef) {
        activeRef.value = isMarkActive(markType);
      }
    });

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

    // Check for inline LaTeX node at cursor position
    const mathInlineType = state.schema.nodes['math_inline'];
    if (mathInlineType) {
      const { from, to } = state.selection;
      let hasLatex = false;
      state.doc.nodesBetween(from, to, (node: any) => {
        if (node.type === mathInlineType) { hasLatex = true; return false; }
      });
      isLatexActive.value = hasLatex;
    }
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

function toggleLink() {
  if (!crepe) return;

  crepe.editor?.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;
    const linkMark = state.schema.marks.link;

    // Check if there's already a link
    const hasLink = state.doc.rangeHasMark(from, to, linkMark);

    if (hasLink) {
      // Remove link
      const commandManager = ctx.get(commandsCtx);
      commandManager.call(toggleLinkCommand.key, { href: '' });
    } else {
      // Show modal for URL input
      linkUrl.value = '';
      linkTitle.value = '';
      linkModalOpen.value = true;
    }
  });
}

function confirmLink() {
  if (!crepe || !linkUrl.value) return;

  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(toggleLinkCommand.key, {
      href: linkUrl.value,
      title: linkTitle.value || undefined
    });
  });

  linkModalOpen.value = false;
  linkUrl.value = '';
  linkTitle.value = '';
}

function cancelLink() {
  linkModalOpen.value = false;
  linkUrl.value = '';
  linkTitle.value = '';
}

// Generic toggle function for custom marks
function toggleCustomMark(markName: string) {
  if (!crepe) return;
  const command = customCommandsMap.get(markName);
  if (!command) {
    console.error(`No command found for mark: ${markName}`);
    return;
  }
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    commandManager.call(command.key);
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

function insertImage() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    const commandManager = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);
    const imageBlock = view.state.schema.nodes['image-block'];

    if (!imageBlock) {
      debug.error('imageBlock node type not found in schema');
      return;
    }

    commandManager.call(clearTextInCurrentBlockCommand.key);
    commandManager.call(addBlockTypeCommand.key, {
      nodeType: imageBlock,
    });
  });
}

function printDocument() {
  window.print();
}

function toggleLatex() {
  if (!crepe) return;
  crepe.editor?.action((ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx.get(commandsCtx) as any).call('ToggleLatex');
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

// Cache DOM references to avoid repeated queries
let cachedSplitWrapper: HTMLElement | null = null;
let cachedWysiwygPane: HTMLElement | null = null;
let cachedSourcePane: HTMLElement | null = null;

function setViewMode(mode: 'wysiwyg' | 'split' | 'source') {
  viewMode.value = mode;
  viewModeDropdownOpen.value = false;

  if (!crepe?.editor) return;

  // Get or cache DOM references
  if (!cachedSplitWrapper) {
    cachedSplitWrapper = document.querySelector('.split-editor') as HTMLElement;
    if (!cachedSplitWrapper) return;

    cachedWysiwygPane = cachedSplitWrapper.children[0] as HTMLElement;
    cachedSourcePane = cachedSplitWrapper.querySelector('.milkdown-split-editor') as HTMLElement;

    if (!cachedWysiwygPane || !cachedSourcePane) return;
  }

  const wrapper = cachedSplitWrapper;
  const wysiwyg = cachedWysiwygPane;
  const source = cachedSourcePane;

  if (!wysiwyg || !source) return;

  // Reset display for both panes
  wysiwyg.style.display = '';
  source.style.display = '';

  // Apply view mode
  if (mode === 'wysiwyg') {
    source.style.display = 'none';
    wrapper.style.gridTemplateColumns = '1fr';
    wrapper.setAttribute('data-view-mode', 'wysiwyg');
  } else if (mode === 'source') {
    wysiwyg.style.display = 'none';
    wrapper.style.gridTemplateColumns = '1fr';
    wrapper.setAttribute('data-view-mode', 'source');
  } else {
    wrapper.style.gridTemplateColumns = '1fr 1fr';
    wrapper.setAttribute('data-view-mode', 'split');
  }
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

let unsubscribeShortcut: (() => void) | null = null;

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  // Handle blockStyleDropdownRef (may be array due to v-for)
  const blockDropdown = Array.isArray(blockStyleDropdownRef.value)
    ? blockStyleDropdownRef.value[0]
    : blockStyleDropdownRef.value;
  if (blockDropdown && !blockDropdown.contains(event.target as Node)) {
    blockStyleDropdownOpen.value = false;
  }

  // Handle listDropdownRef (may be array due to v-for)
  const listDropdown = Array.isArray(listDropdownRef.value)
    ? listDropdownRef.value[0]
    : listDropdownRef.value;
  if (listDropdown && !listDropdown.contains(event.target as Node)) {
    listDropdownOpen.value = false;
  }

  // Handle viewModeDropdownRef
  if (viewModeDropdownRef.value && !viewModeDropdownRef.value.contains(event.target as Node)) {
    viewModeDropdownOpen.value = false;
  }
}

onMounted(async () => {
  debug.log('Component mounted for file:', props.filePath);
  await loadFile();

  // Add click outside listener for dropdown
  document.addEventListener('click', handleClickOutside);

  // Toolbar scroll
  const el = toolbarScrollContainer.value;
  if (el) {
    el.addEventListener('scroll', checkToolbarOverflow);
    toolbarResizeObserver = new ResizeObserver(checkToolbarOverflow);
    toolbarResizeObserver.observe(el);
  }
  nextTick(checkToolbarOverflow);

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

  // Toolbar scroll cleanup
  toolbarScrollContainer.value?.removeEventListener('scroll', checkToolbarOverflow);
  toolbarResizeObserver?.disconnect();

  // Clear DOM cache for next component instance
  cachedSplitWrapper = null;
  cachedWysiwygPane = null;
  cachedSourcePane = null;

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
    <div v-if="!loading" class="no-print flex items-center py-0.5 border-b border-base-300 bg-base-200/50">
      <button
        v-if="showToolbarLeftArrow"
        type="button"
        class="btn btn-ghost btn-xs btn-square flex-shrink-0"
        @mousedown.prevent
        @click="scrollToolbarLeft"
      >
        <ChevronLeft class="w-3 h-3" />
      </button>

      <div ref="toolbarScrollContainer" class="flex-1 overflow-hidden min-w-0">
        <div class="flex items-center gap-1 px-3 w-max">
      <template v-for="item in computedToolbarItems" :key="item.id">
        <!-- Divider -->
        <div v-if="item.type === 'divider'" class="w-px h-5 bg-base-300 mx-1"></div>

        <!-- Block Style Dropdown -->
        <div v-else-if="item.type === 'dropdown' && item.dropdownType === 'block-style'" ref="blockStyleDropdownRef" class="relative">
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

        <!-- List Dropdown -->
        <div v-else-if="item.type === 'dropdown' && item.dropdownType === 'list'" ref="listDropdownRef" class="relative">
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

        <!-- Regular Button -->
        <button
          v-else-if="item.type === 'button'"
          type="button"
          class="flex items-center justify-center w-8 h-8 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 p-0 hover:bg-primary/20"
          :class="{ 'bg-base-300 text-primary': getButtonActiveState(item) }"
          @mousedown.prevent
          @click="handleToolbarAction(item.action!)"
          :title="item.title"
        >
          <component :is="item.icon" :size="16" />
        </button>
      </template>
        </div>
      </div>

      <button
        v-if="showToolbarRightArrow"
        type="button"
        class="btn btn-ghost btn-xs btn-square flex-shrink-0"
        @mousedown.prevent
        @click="scrollToolbarRight"
      >
        <ChevronRight class="w-3 h-3" />
      </button>

      <!-- View Mode Dropdown (Split Editing) - pinned right, outside scroll area -->
      <div ref="viewModeDropdownRef" class="relative flex-shrink-0 pr-1">
        <button
          type="button"
          class="flex items-center gap-1 h-8 px-2 border-0 rounded bg-transparent text-base-content/60 cursor-pointer transition-colors duration-200 hover:bg-primary/20"
          @mousedown.prevent
          @click="viewModeDropdownOpen = !viewModeDropdownOpen"
          title="View mode"
        >
          <Columns2 :size="16" />
          <ChevronDown :size="12" />
        </button>

        <!-- Dropdown menu -->
        <div
          v-if="viewModeDropdownOpen"
          class="absolute top-full right-0 mt-1 py-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 min-w-[140px]"
          @mousedown.prevent
        >
          <button
            v-for="mode in [{ value: 'wysiwyg', label: 'WYSIWYG' }, { value: 'split', label: 'Split' }, { value: 'source', label: 'Source' }]"
            :key="mode.value"
            type="button"
            class="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-base-content hover:bg-base-200 cursor-pointer"
            :class="{ 'bg-base-200 text-primary': viewMode === mode.value }"
            @click="setViewMode(mode.value as any)"
          >
            <span>{{ mode.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div v-if="!loading" ref="editorEl" class="editor-wrap flex-1 min-h-0"></div>


    <!-- Link modal -->
    <div v-if="linkModalOpen" class="modal modal-open" @click.self="cancelLink">
      <div class="modal-box relative z-50">
        <h3 class="font-bold text-lg mb-4">Insert Link</h3>

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">URL</span>
          </label>
          <input
            v-model="linkUrl"
            type="text"
            placeholder="https://example.com"
            class="input input-bordered w-full"
            @keyup.enter="confirmLink"
            @keyup.esc="cancelLink"
            autofocus
          />
        </div>

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Title (optional)</span>
          </label>
          <input
            v-model="linkTitle"
            type="text"
            placeholder="Link title"
            class="input input-bordered w-full"
            @keyup.enter="confirmLink"
            @keyup.esc="cancelLink"
          />
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="cancelLink">Cancel</button>
          <button class="btn btn-primary" @click="confirmLink" :disabled="!linkUrl">Insert</button>
        </div>
      </div>
    </div>
  </div>
</template>
