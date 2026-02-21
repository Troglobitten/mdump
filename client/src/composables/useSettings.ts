import { ref, readonly } from 'vue';
import type { UserPreferences } from '@mdump/shared';
import { DEFAULT_PREFERENCES } from '@mdump/shared';
import { settingsApi } from '@/api/client';
import { useTheme } from '@/composables/useTheme';

const preferences = ref<UserPreferences>({ ...DEFAULT_PREFERENCES });
const loading = ref(false);
const error = ref<string | null>(null);

export function useSettings() {
  async function loadPreferences(): Promise<UserPreferences> {
    loading.value = true;
    error.value = null;

    try {
      const prefs = await settingsApi.getPreferences();
      preferences.value = { ...DEFAULT_PREFERENCES, ...prefs };

      // Migrate toolbar config: add missing default items to existing configs
      if (preferences.value.toolbarConfig) {
        const currentItems = preferences.value.toolbarConfig.items;
        const defaultItems = DEFAULT_PREFERENCES.toolbarConfig.items;
        const currentIds = new Set(currentItems.map(item => item.id));

        // Find items in default config that are missing from current config
        const missingItems = defaultItems.filter(item => !currentIds.has(item.id));

        if (missingItems.length > 0) {
          // Add missing items and update
          const updatedItems = [...currentItems, ...missingItems];
          preferences.value.toolbarConfig.items = updatedItems;

          // Save the migrated config
          await settingsApi.updatePreferences({
            toolbarConfig: preferences.value.toolbarConfig,
          });
        }
      }

      applyPaperSize(preferences.value.paperSize);
      applyEditorStyles();
      applyEditorTheming();
      return preferences.value;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load preferences';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const prefs = await settingsApi.updatePreferences(updates);
      preferences.value = { ...preferences.value, ...prefs };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update preferences';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function setTheme(theme: string): Promise<void> {
    await updatePreferences({ theme });
    const { setTheme: applyTheme } = useTheme();
    applyTheme(theme);
  }

  async function setSidebarWidth(width: number): Promise<void> {
    await updatePreferences({ sidebarWidth: width });
  }

  async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
    await updatePreferences({ sidebarCollapsed: collapsed });
  }

  async function setAutoSaveEnabled(enabled: boolean): Promise<void> {
    await updatePreferences({
      autoSave: { ...preferences.value.autoSave, enabled },
    });
  }

  async function setAutoSaveDebounce(debounceMs: number): Promise<void> {
    await updatePreferences({
      autoSave: { ...preferences.value.autoSave, debounceMs },
    });
  }

  async function setExternalChangeWarning(enabled: boolean): Promise<void> {
    await updatePreferences({ externalChangeWarning: enabled });
  }

  async function setPaperSize(size: string): Promise<void> {
    await updatePreferences({ paperSize: size });
    applyPaperSize(size);
    applyEditorStyles();
  }

  async function setVerticalSpacing(spacing: 'default' | 'compact' | 'comfortable'): Promise<void> {
    await updatePreferences({ verticalSpacing: spacing });
    applyEditorStyles();
  }

  async function setFontScale(scale: number): Promise<void> {
    await updatePreferences({ fontScale: scale });
    applyEditorStyles();
  }

  async function setPageWidthMode(enabled: boolean): Promise<void> {
    await updatePreferences({ pageWidthMode: enabled });
    applyEditorStyles();
  }

  async function setPrintFontScale(scale: number): Promise<void> {
    await updatePreferences({ printFontScale: scale });
    applyEditorStyles();
  }

  async function setPrintVerticalSpacing(spacing: 'default' | 'compact' | 'comfortable'): Promise<void> {
    await updatePreferences({ printVerticalSpacing: spacing });
    applyEditorStyles();
  }

  async function setDebug(enabled: boolean): Promise<void> {
    await updatePreferences({ debug: enabled });
  }

  async function setMdumpThemedEditor(enabled: boolean): Promise<void> {
    await updatePreferences({ mdumpThemedEditor: enabled });
    applyEditorTheming();
  }

  async function setEditorFont(font: 'sans-serif' | 'serif' | 'monospace'): Promise<void> {
    await updatePreferences({ editorFont: font });
    applyEditorStyles();
  }

  async function setShowDocumentOutline(enabled: boolean): Promise<void> {
    await updatePreferences({ showDocumentOutline: enabled });
  }

  async function updateToolbarConfig(config: Partial<import('@mdump/shared').ToolbarConfig>): Promise<void> {
    const currentConfig = preferences.value.toolbarConfig;
    await updatePreferences({
      toolbarConfig: { ...currentConfig, ...config },
    });
  }

  function applyEditorTheming() {
    document.documentElement.setAttribute(
      'data-mdump-themed-editor',
      String(preferences.value.mdumpThemedEditor)
    );
  }

  function applyPaperSize(size: string) {
    let styleEl = document.getElementById('print-page-size') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'print-page-size';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: ${size}; }`;
  }

  // Paper size → CSS width using physical units (cm for metric, in for US)
  const PAGE_WIDTH_MAP: Record<string, string> = {
    A5: '14.8cm',
    A4: '21cm',
    Letter: '8.5in',
    Legal: '8.5in',
    A3: '29.7cm',
  };

  const SPACING_MAP: Record<string, string> = {
    compact: '0.15',
    default: '0.35',
    comfortable: '0.6',
  };

  const FONT_MAP: Record<string, string> = {
    'sans-serif': 'Inter, Arial, Helvetica, sans-serif',
    'serif': 'Georgia, "Times New Roman", Times, serif',
    'monospace': 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  };

  function applyEditorStyles() {
    const root = document.documentElement;

    // Remove old dynamic style element if it exists
    const oldStyleEl = document.getElementById('editor-custom-styles');
    if (oldStyleEl) {
      oldStyleEl.remove();
    }

    // Screen styles
    const factor = SPACING_MAP[preferences.value.verticalSpacing] || '0.35';
    const fontSize = preferences.value.fontScale / 100;
    const fontFamily = FONT_MAP[preferences.value.editorFont] || FONT_MAP['sans-serif'];

    const paperWidth = PAGE_WIDTH_MAP[preferences.value.paperSize] || '21cm';
    const paddingValue = preferences.value.pageWidthMode
      ? `max(2em, calc((100% - ${paperWidth}) / 2))`
      : '0';

    // Set CSS custom properties
    root.style.setProperty('--editor-spacing-factor', factor);
    root.style.setProperty('--editor-font-scale', String(fontSize));
    root.style.setProperty('--editor-font-family', fontFamily);
    root.style.setProperty('--editor-padding-left', paddingValue);
    root.style.setProperty('--editor-padding-right', paddingValue);

    // Print styles (still need a style tag for media queries)
    const printFactor = SPACING_MAP[preferences.value.printVerticalSpacing] || '0.35';
    const printFontSize = preferences.value.printFontScale / 100;

    let printStyleEl = document.getElementById('editor-print-styles') as HTMLStyleElement | null;
    if (!printStyleEl) {
      printStyleEl = document.createElement('style');
      printStyleEl.id = 'editor-print-styles';
      document.head.appendChild(printStyleEl);
    }

    printStyleEl.textContent = `
      @media print {
        .editor-wrap .ProseMirror {
          --spacing-factor: ${printFactor} !important;
          font-size: ${printFontSize}em !important;
        }
      }
    `;
  }

  return {
    preferences: readonly(preferences),
    loading: readonly(loading),
    error: readonly(error),
    loadPreferences,
    updatePreferences,
    setTheme,
    setSidebarWidth,
    setSidebarCollapsed,
    setAutoSaveEnabled,
    setAutoSaveDebounce,
    setExternalChangeWarning,
    setPaperSize,
    applyPaperSize,
    setVerticalSpacing,
    setFontScale,
    setPageWidthMode,
    setPrintFontScale,
    setPrintVerticalSpacing,
    setDebug,
    setMdumpThemedEditor,
    setEditorFont,
    updateToolbarConfig,
    setShowDocumentOutline,
    applyEditorStyles,
  };
}
