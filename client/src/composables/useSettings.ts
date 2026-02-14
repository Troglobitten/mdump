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

  async function setEditorFont(font: 'Inter' | 'Work Sans' | 'Merriweather' | 'Lora' | 'Fira Code'): Promise<void> {
    await updatePreferences({ editorFont: font });
    applyEditorStyles();
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
    Inter: '"Inter", sans-serif',
    'Work Sans': '"Work Sans", sans-serif',
    Merriweather: '"Merriweather", serif',
    Lora: '"Lora", serif',
    'Fira Code': '"Fira Code", monospace',
  };

  function applyEditorStyles() {
    let styleEl = document.getElementById('editor-custom-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'editor-custom-styles';
      document.head.appendChild(styleEl);
    }

    // Screen styles
    const factor = SPACING_MAP[preferences.value.verticalSpacing] || '0.35';
    const fontSize = preferences.value.fontScale / 100;
    const fontFamily = FONT_MAP[preferences.value.editorFont] || FONT_MAP.Inter;

    const paperWidth = PAGE_WIDTH_MAP[preferences.value.paperSize] || '21cm';
    const pageWidthPadding = preferences.value.pageWidthMode
      ? `padding-left: max(2em, calc((100% - ${paperWidth}) / 2)) !important;
         padding-right: max(2em, calc((100% - ${paperWidth}) / 2)) !important;`
      : '';

    // Print styles
    const printFactor = SPACING_MAP[preferences.value.printVerticalSpacing] || '0.35';
    const printFontSize = preferences.value.printFontScale / 100;

    styleEl.textContent = `
      /* Set Milkdown font CSS variables */
      .milkdown {
        --crepe-font-title: ${fontFamily};
        --crepe-font-default: ${fontFamily};
        --crepe-font-code: "Fira Code", monospace;
      }

      /* Font size and spacing (Milkdown doesn't have variables for these) */
      .editor-wrap .ProseMirror {
        --spacing-factor: ${factor};
        font-size: ${fontSize}em;
        ${pageWidthPadding}
      }

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
    applyEditorStyles,
  };
}
