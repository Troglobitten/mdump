import { ref, readonly } from 'vue';
import type { FileNode, FileContent } from '@mdump/shared';
import { filesApi, foldersApi } from '@/api/client';

const fileTree = ref<FileNode[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const expandedFolders = ref<Set<string>>(new Set());
const selectedFolder = ref<string | null>(null);
const currentListFolder = ref<string>('');

// Track recently saved paths to distinguish our saves from external changes
const recentlySaved = new Map<string, number>();
const RECENT_SAVE_THRESHOLD = 3000;

export function useFiles() {
  async function loadFileTree(): Promise<FileNode[]> {
    loading.value = true;
    error.value = null;

    try {
      const tree = await filesApi.getTree();
      fileTree.value = tree;
      return tree;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load files';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getFile(path: string): Promise<FileContent> {
    try {
      return await filesApi.getFile(path);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load file';
      throw err;
    }
  }

  async function createFile(path: string, content: string = ''): Promise<FileContent> {
    try {
      const file = await filesApi.createFile(path, content);
      await loadFileTree();
      return file;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create file';
      throw err;
    }
  }

  async function saveFile(path: string, content: string): Promise<FileContent> {
    try {
      recentlySaved.set(path, Date.now());
      return await filesApi.updateFile(path, content);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save file';
      throw err;
    }
  }

  function wasRecentlySaved(path: string): boolean {
    const timestamp = recentlySaved.get(path);
    if (!timestamp) return false;
    if (Date.now() - timestamp < RECENT_SAVE_THRESHOLD) return true;
    recentlySaved.delete(path);
    return false;
  }

  async function deleteFile(path: string): Promise<void> {
    try {
      await filesApi.deleteFile(path);
      await loadFileTree();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete file';
      throw err;
    }
  }

  async function renameFile(path: string, newName: string): Promise<string> {
    try {
      const newPath = await filesApi.renameFile(path, newName);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename file';
      throw err;
    }
  }

  async function moveFile(path: string, destination: string): Promise<string> {
    try {
      const newPath = await filesApi.moveFile(path, destination);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to move file';
      throw err;
    }
  }

  async function duplicateFile(path: string): Promise<string> {
    try {
      const newPath = await filesApi.duplicateFile(path);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to duplicate file';
      throw err;
    }
  }

  async function createFolder(path: string): Promise<string> {
    try {
      const newPath = await foldersApi.create(path);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create folder';
      throw err;
    }
  }

  async function deleteFolder(path: string): Promise<void> {
    try {
      await foldersApi.delete(path);
      await loadFileTree();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete folder';
      throw err;
    }
  }

  async function renameFolder(path: string, newName: string): Promise<string> {
    try {
      const newPath = await foldersApi.rename(path, newName);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to rename folder';
      throw err;
    }
  }

  async function moveFolder(path: string, destination: string): Promise<string> {
    try {
      const newPath = await foldersApi.move(path, destination);
      await loadFileTree();
      return newPath;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to move folder';
      throw err;
    }
  }

  function toggleFolder(path: string): void {
    if (expandedFolders.value.has(path)) {
      expandedFolders.value.delete(path);
    } else {
      expandedFolders.value.add(path);
    }
  }

  function expandFolder(path: string): void {
    expandedFolders.value.add(path);
  }

  function collapseFolder(path: string): void {
    expandedFolders.value.delete(path);
  }

  function isFolderExpanded(path: string): boolean {
    return expandedFolders.value.has(path);
  }

  function setSelectedFolder(path: string | null): void {
    selectedFolder.value = path;
  }

  function setCurrentListFolder(path: string): void {
    currentListFolder.value = path;
  }

  function navigateUpListFolder(): void {
    const lastSlash = currentListFolder.value.lastIndexOf('/');
    currentListFolder.value = lastSlash >= 0 ? currentListFolder.value.substring(0, lastSlash) : '';
    selectedFolder.value = currentListFolder.value;
  }

  function expandToFile(filePath: string): void {
    const parts = filePath.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      expandFolder(currentPath);
    }
  }

  return {
    fileTree: readonly(fileTree),
    loading: readonly(loading),
    error: readonly(error),
    expandedFolders: readonly(expandedFolders),
    selectedFolder: readonly(selectedFolder),
    currentListFolder: readonly(currentListFolder),
    loadFileTree,
    getFile,
    createFile,
    saveFile,
    deleteFile,
    renameFile,
    moveFile,
    duplicateFile,
    createFolder,
    deleteFolder,
    renameFolder,
    moveFolder,
    toggleFolder,
    expandFolder,
    collapseFolder,
    isFolderExpanded,
    expandToFile,
    setSelectedFolder,
    setCurrentListFolder,
    navigateUpListFolder,
    wasRecentlySaved,
  };
}
