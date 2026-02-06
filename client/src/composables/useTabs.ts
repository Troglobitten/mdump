import { ref, computed, readonly } from 'vue';
import type { TabState } from '@mdump/shared';
import { settingsApi } from '@/api/client';

const tabs = ref<TabState[]>([]);
const activeTabPath = ref<string | null>(null);
const loading = ref(false);

// Debounce save to avoid excessive API calls
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function useTabs() {
  const activeTab = computed(() => tabs.value.find((t) => t.path === activeTabPath.value) || null);

  const hasUnsavedChanges = computed(() => tabs.value.some((t) => t.isDirty));

  async function loadTabs(): Promise<void> {
    loading.value = true;
    try {
      const { openTabs, activeTabPath: activePath } = await settingsApi.getTabs();
      tabs.value = openTabs || [];
      activeTabPath.value = activePath;
    } catch (err) {
      console.error('Failed to load tabs:', err);
    } finally {
      loading.value = false;
    }
  }

  function saveTabs(): void {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        await settingsApi.saveTabs(tabs.value, activeTabPath.value);
      } catch (err) {
        console.error('Failed to save tabs:', err);
      }
    }, 1000);
  }

  function openTab(path: string, name: string): void {
    const existingTab = tabs.value.find((t) => t.path === path);

    if (existingTab) {
      activeTabPath.value = path;
    } else {
      const newTab: TabState = {
        path,
        name,
        isDirty: false,
      };
      tabs.value.push(newTab);
      activeTabPath.value = path;
    }

    saveTabs();
  }

  function closeTab(path: string): boolean {
    const tabIndex = tabs.value.findIndex((t) => t.path === path);
    if (tabIndex === -1) return true;

    const tab = tabs.value[tabIndex];

    // Return false if tab has unsaved changes (caller should handle confirmation)
    if (tab.isDirty) {
      return false;
    }

    tabs.value.splice(tabIndex, 1);

    // Update active tab if we closed the active one
    if (activeTabPath.value === path) {
      if (tabs.value.length > 0) {
        // Activate the tab to the left, or the first tab
        const newIndex = Math.min(tabIndex, tabs.value.length - 1);
        activeTabPath.value = tabs.value[newIndex].path;
      } else {
        activeTabPath.value = null;
      }
    }

    saveTabs();
    return true;
  }

  function forceCloseTab(path: string): void {
    const tabIndex = tabs.value.findIndex((t) => t.path === path);
    if (tabIndex === -1) return;

    tabs.value.splice(tabIndex, 1);

    if (activeTabPath.value === path) {
      if (tabs.value.length > 0) {
        const newIndex = Math.min(tabIndex, tabs.value.length - 1);
        activeTabPath.value = tabs.value[newIndex].path;
      } else {
        activeTabPath.value = null;
      }
    }

    saveTabs();
  }

  function setActiveTab(path: string): void {
    const tab = tabs.value.find((t) => t.path === path);
    if (tab) {
      activeTabPath.value = path;
      saveTabs();
    }
  }

  function markDirty(path: string, dirty: boolean = true): void {
    const tab = tabs.value.find((t) => t.path === path);
    if (tab) {
      tab.isDirty = dirty;
    }
  }

  function updateTabPath(oldPath: string, newPath: string, newName: string): void {
    const tab = tabs.value.find((t) => t.path === oldPath);
    if (tab) {
      tab.path = newPath;
      tab.name = newName;

      if (activeTabPath.value === oldPath) {
        activeTabPath.value = newPath;
      }

      saveTabs();
    }
  }

  function reorderTabs(fromIndex: number, toIndex: number): void {
    const [tab] = tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, tab);
    saveTabs();
  }

  function nextTab(): void {
    if (tabs.value.length <= 1) return;

    const currentIndex = tabs.value.findIndex((t) => t.path === activeTabPath.value);
    const nextIndex = (currentIndex + 1) % tabs.value.length;
    activeTabPath.value = tabs.value[nextIndex].path;
    saveTabs();
  }

  function prevTab(): void {
    if (tabs.value.length <= 1) return;

    const currentIndex = tabs.value.findIndex((t) => t.path === activeTabPath.value);
    const prevIndex = currentIndex <= 0 ? tabs.value.length - 1 : currentIndex - 1;
    activeTabPath.value = tabs.value[prevIndex].path;
    saveTabs();
  }

  function getTabByPath(path: string): TabState | undefined {
    return tabs.value.find((t) => t.path === path);
  }

  function closeAllTabs(): boolean {
    if (tabs.value.some((t) => t.isDirty)) {
      return false;
    }

    tabs.value = [];
    activeTabPath.value = null;
    saveTabs();
    return true;
  }

  function closeOtherTabs(path: string): boolean {
    if (tabs.value.some((t) => t.path !== path && t.isDirty)) {
      return false;
    }

    tabs.value = tabs.value.filter((t) => t.path === path);
    activeTabPath.value = path;
    saveTabs();
    return true;
  }

  return {
    tabs: readonly(tabs),
    activeTabPath: readonly(activeTabPath),
    activeTab,
    hasUnsavedChanges,
    loading: readonly(loading),
    loadTabs,
    openTab,
    closeTab,
    forceCloseTab,
    setActiveTab,
    markDirty,
    updateTabPath,
    reorderTabs,
    nextTab,
    prevTab,
    getTabByPath,
    closeAllTabs,
    closeOtherTabs,
  };
}
