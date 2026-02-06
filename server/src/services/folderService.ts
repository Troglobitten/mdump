import { mkdir, rmdir, rename, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { NOTES_DIR } from '../config/constants.js';
import { sandboxPath, getRelativePath, isHiddenPath } from '../utils/paths.js';
import { validateFilename } from '../utils/filename.js';

/**
 * Create a new folder
 */
export async function createFolder(relativePath: string): Promise<string> {
  const fullPath = sandboxPath(relativePath);

  if (existsSync(fullPath)) {
    throw new Error('Folder already exists');
  }

  // Validate folder name
  const folderName = basename(fullPath);
  const validation = validateFilename(folderName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  await mkdir(fullPath, { recursive: true });

  return getRelativePath(fullPath);
}

/**
 * Delete a folder and all its contents
 */
export async function deleteFolder(relativePath: string): Promise<void> {
  if (!relativePath || relativePath === '' || relativePath === '/') {
    throw new Error('Cannot delete the root folder');
  }

  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('Folder not found');
  }

  const stats = await stat(fullPath);
  if (!stats.isDirectory()) {
    throw new Error('Not a folder');
  }

  await deleteFolderRecursive(fullPath);
}

/**
 * Rename a folder
 */
export async function renameFolder(relativePath: string, newName: string): Promise<string> {
  if (!relativePath || relativePath === '' || relativePath === '/') {
    throw new Error('Cannot rename the root folder');
  }

  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('Folder not found');
  }

  const stats = await stat(fullPath);
  if (!stats.isDirectory()) {
    throw new Error('Not a folder');
  }

  // Validate new folder name
  const validation = validateFilename(newName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newFullPath = join(dirname(fullPath), newName);

  if (existsSync(newFullPath)) {
    throw new Error('A folder with that name already exists');
  }

  await rename(fullPath, newFullPath);

  return getRelativePath(newFullPath);
}

/**
 * Move a folder to a different parent directory
 */
export async function moveFolder(relativePath: string, newParentPath: string): Promise<string> {
  if (!relativePath || relativePath === '' || relativePath === '/') {
    throw new Error('Cannot move the root folder');
  }

  const fullPath = sandboxPath(relativePath);
  const newParentFullPath = newParentPath ? sandboxPath(newParentPath) : NOTES_DIR;

  if (!existsSync(fullPath)) {
    throw new Error('Folder not found');
  }

  const stats = await stat(fullPath);
  if (!stats.isDirectory()) {
    throw new Error('Not a folder');
  }

  if (newParentFullPath !== NOTES_DIR && !existsSync(newParentFullPath)) {
    throw new Error('Destination folder not found');
  }

  // Prevent moving a folder into itself or its descendants
  const normalizedSourcePath = fullPath.replace(/\/$/, '');
  const normalizedDestPath = newParentFullPath.replace(/\/$/, '');
  if (
    normalizedDestPath === normalizedSourcePath ||
    normalizedDestPath.startsWith(normalizedSourcePath + '/')
  ) {
    throw new Error('Cannot move a folder into itself');
  }

  const folderName = basename(fullPath);
  const newFullPath = join(newParentFullPath, folderName);

  if (existsSync(newFullPath)) {
    throw new Error('A folder with that name already exists in the destination');
  }

  await rename(fullPath, newFullPath);

  return getRelativePath(newFullPath);
}

/**
 * Check if a folder exists
 */
export async function folderExists(relativePath: string): Promise<boolean> {
  try {
    const fullPath = sandboxPath(relativePath);
    if (!existsSync(fullPath)) {
      return false;
    }
    const stats = await stat(fullPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get all folders (flat list)
 */
export async function getAllFolders(relativePath: string = ''): Promise<string[]> {
  const fullPath = sandboxPath(relativePath);
  const folders: string[] = [];

  if (!existsSync(fullPath)) {
    return folders;
  }

  const entries = await readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const entryPath = relativePath ? join(relativePath, entry.name) : entry.name;
      folders.push(entryPath);

      // Recursively get subfolders
      const subfolders = await getAllFolders(entryPath);
      folders.push(...subfolders);
    }
  }

  return folders.sort();
}

/**
 * Helper to recursively delete a folder and its contents
 */
async function deleteFolderRecursive(folderPath: string): Promise<void> {
  const entries = await readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(folderPath, entry.name);

    if (entry.isDirectory()) {
      await deleteFolderRecursive(entryPath);
    } else {
      await unlink(entryPath);
    }
  }

  await rmdir(folderPath);
}
