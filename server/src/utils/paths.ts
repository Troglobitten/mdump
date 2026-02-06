import { resolve, relative, normalize, join, dirname, basename, extname } from 'path';
import { NOTES_DIR, HIDDEN_FOLDER_PREFIX, MARKDOWN_EXTENSION } from '../config/constants.js';

/**
 * Normalize and sandbox a path to prevent directory traversal attacks.
 * Returns the full path if valid, or throws an error if the path escapes the sandbox.
 */
export function sandboxPath(userPath: string, baseDir: string = NOTES_DIR): string {
  // Normalize and resolve the path
  const normalized = normalize(userPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = resolve(baseDir, normalized);

  // Ensure the resolved path is within the base directory
  const relativePath = relative(baseDir, fullPath);
  if (relativePath.startsWith('..') || resolve(baseDir, relativePath) !== fullPath) {
    throw new Error('Path traversal attempt detected');
  }

  return fullPath;
}

/**
 * Get the relative path from the notes directory
 */
export function getRelativePath(fullPath: string): string {
  return relative(NOTES_DIR, fullPath);
}

/**
 * Check if a path refers to a hidden folder or file within a hidden folder
 */
export function isHiddenPath(filePath: string): boolean {
  const parts = filePath.split(/[/\\]/);
  return parts.some((part) => part.startsWith(HIDDEN_FOLDER_PREFIX) && part.length > 1);
}

/**
 * Get the attachment folder path for a note
 * e.g., /notes/folder/note.md -> /notes/folder/.note/
 */
export function getAttachmentFolder(notePath: string): string {
  const dir = dirname(notePath);
  const name = basename(notePath, extname(notePath));
  return join(dir, `${HIDDEN_FOLDER_PREFIX}${name}`);
}

/**
 * Check if a file is a markdown file
 */
export function isMarkdownFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === MARKDOWN_EXTENSION;
}

/**
 * Ensure a filename has the .md extension
 */
export function ensureMarkdownExtension(filename: string): string {
  if (!filename.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    return `${filename}${MARKDOWN_EXTENSION}`;
  }
  return filename;
}

/**
 * Remove the .md extension from a filename
 */
export function removeMarkdownExtension(filename: string): string {
  if (filename.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    return filename.slice(0, -MARKDOWN_EXTENSION.length);
  }
  return filename;
}

/**
 * Join path segments safely
 */
export function joinPath(...segments: string[]): string {
  return join(...segments);
}

/**
 * Get the parent directory of a path
 */
export function getParentDir(filePath: string): string {
  return dirname(filePath);
}

/**
 * Get the filename from a path
 */
export function getFilename(filePath: string): string {
  return basename(filePath);
}

/**
 * Get the filename without extension
 */
export function getBasename(filePath: string): string {
  return basename(filePath, extname(filePath));
}
