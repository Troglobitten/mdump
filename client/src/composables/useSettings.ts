import { ref, readonly } from 'vue';
import type { UserPreferences } from '@mdump/shared';
import { DEFAULT_PREFERENCES } from '@mdump/shared';
import { settingsApi } from '@/api/client';

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
    document.documentElement.setAttribute('data-theme', theme);
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
  };
}
