import { readFile, writeFile, unlink, rename, stat, readdir, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import type { FileNode, FileContent } from '@mdump/shared';
import { NOTES_DIR, MARKDOWN_EXTENSION } from '../config/constants.js';
import {
  sandboxPath,
  getRelativePath,
  isHiddenPath,
  getAttachmentFolder,
  ensureMarkdownExtension,
  isMarkdownFile,
} from '../utils/paths.js';
import { validateFilename, generateUniqueFilename } from '../utils/filename.js';

/**
 * Ensure the notes directory exists
 */
export async function ensureNotesDir(): Promise<void> {
  if (!existsSync(NOTES_DIR)) {
    await mkdir(NOTES_DIR, { recursive: true });
  }
}

/**
 * Get the file tree starting from a directory
 */
export async function getFileTree(relativePath: string = ''): Promise<FileNode[]> {
  await ensureNotesDir();

  const fullPath = sandboxPath(relativePath);
  const entries = await readdir(fullPath, { withFileTypes: true });

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files and folders (attachment folders)
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = join(relativePath, entry.name);
    const entryFullPath = join(fullPath, entry.name);

    if (entry.isDirectory()) {
      const children = await getFileTree(entryPath);
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'folder',
        children,
      });
    } else if (isMarkdownFile(entry.name)) {
      const stats = await stat(entryFullPath);
      nodes.push({
        name: entry.name,
        path: entryPath,
        type: 'file',
        modifiedAt: stats.mtime.toISOString(),
        size: stats.size,
      });
    }
  }

  // Sort: folders first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return nodes;
}

/**
 * Read a file's content
 */
export async function readFileContent(relativePath: string): Promise<FileContent> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  if (!isMarkdownFile(fullPath)) {
    throw new Error('Not a markdown file');
  }

  const content = await readFile(fullPath, 'utf-8');
  const stats = await stat(fullPath);

  return {
    path: relativePath,
    content,
    modifiedAt: stats.mtime.toISOString(),
  };
}

/**
 * Create a new file
 */
export async function createFile(
  relativePath: string,
  content: string = ''
): Promise<FileContent> {
  const fullPath = sandboxPath(ensureMarkdownExtension(relativePath));

  if (existsSync(fullPath)) {
    throw new Error('File already exists');
  }

  // Validate filename
  const filename = basename(fullPath);
  const validation = validateFilename(filename);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Ensure parent directory exists
  const parentDir = dirname(fullPath);
  if (!existsSync(parentDir)) {
    await mkdir(parentDir, { recursive: true });
  }

  await writeFile(fullPath, content, 'utf-8');
  const stats = await stat(fullPath);

  return {
    path: getRelativePath(fullPath),
    content,
    modifiedAt: stats.mtime.toISOString(),
  };
}

/**
 * Update a file's content
 */
export async function updateFile(relativePath: string, content: string): Promise<FileContent> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  if (!isMarkdownFile(fullPath)) {
    throw new Error('Not a markdown file');
  }

  await writeFile(fullPath, content, 'utf-8');
  const stats = await stat(fullPath);

  return {
    path: relativePath,
    content,
    modifiedAt: stats.mtime.toISOString(),
  };
}

/**
 * Delete a file and its attachment folder
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  if (!isMarkdownFile(fullPath)) {
    throw new Error('Not a markdown file');
  }

  // Delete the file
  await unlink(fullPath);

  // Delete attachment folder if it exists
  const attachmentFolder = getAttachmentFolder(fullPath);
  if (existsSync(attachmentFolder)) {
    await deleteDirectory(attachmentFolder);
  }
}

/**
 * Rename a file
 */
export async function renameFile(relativePath: string, newName: string): Promise<string> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  // Validate new filename
  const newFilename = ensureMarkdownExtension(newName);
  const validation = validateFilename(newFilename);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newFullPath = join(dirname(fullPath), newFilename);

  if (existsSync(newFullPath)) {
    throw new Error('A file with that name already exists');
  }

  // Rename attachment folder if it exists
  const oldAttachmentFolder = getAttachmentFolder(fullPath);
  const newAttachmentFolder = getAttachmentFolder(newFullPath);

  await rename(fullPath, newFullPath);

  if (existsSync(oldAttachmentFolder)) {
    await rename(oldAttachmentFolder, newAttachmentFolder);
  }

  return getRelativePath(newFullPath);
}

/**
 * Move a file to a different directory
 */
export async function moveFile(relativePath: string, newParentPath: string): Promise<string> {
  const fullPath = sandboxPath(relativePath);
  const newParentFullPath = sandboxPath(newParentPath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  if (!existsSync(newParentFullPath)) {
    throw new Error('Destination folder not found');
  }

  const filename = basename(fullPath);
  const newFullPath = join(newParentFullPath, filename);

  if (existsSync(newFullPath)) {
    throw new Error('A file with that name already exists in the destination');
  }

  // Move attachment folder if it exists
  const oldAttachmentFolder = getAttachmentFolder(fullPath);
  const newAttachmentFolder = getAttachmentFolder(newFullPath);

  await rename(fullPath, newFullPath);

  if (existsSync(oldAttachmentFolder)) {
    await rename(oldAttachmentFolder, newAttachmentFolder);
  }

  return getRelativePath(newFullPath);
}

/**
 * Duplicate a file
 */
export async function duplicateFile(relativePath: string): Promise<string> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  const dir = dirname(fullPath);
  const ext = extname(fullPath);
  const baseName = basename(fullPath, ext);

  // Get existing files in directory
  const entries = await readdir(dir);

  // Generate unique name
  const newName = generateUniqueFilename(`${baseName} copy`, entries, ext);
  const newFullPath = join(dir, newName);

  await copyFile(fullPath, newFullPath);

  return getRelativePath(newFullPath);
}

/**
 * Check if a file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    const fullPath = sandboxPath(relativePath);
    return existsSync(fullPath) && isMarkdownFile(fullPath);
  } catch {
    return false;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  relativePath: string
): Promise<{ modifiedAt: string; size: number }> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    throw new Error('File not found');
  }

  const stats = await stat(fullPath);

  return {
    modifiedAt: stats.mtime.toISOString(),
    size: stats.size,
  };
}

/**
 * Helper to recursively delete a directory
 */
async function deleteDirectory(dirPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await deleteDirectory(fullPath);
    } else {
      await unlink(fullPath);
    }
  }

  const { rmdir } = await import('fs/promises');
  await rmdir(dirPath);
}
