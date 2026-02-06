import { mkdir, readdir, unlink, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { lookup } from 'mime-types';
import sharp from 'sharp';
import type { UploadResult, AttachmentInfo } from '@mdump/shared';
import { MAX_UPLOAD_SIZE, ALLOWED_UPLOAD_TYPES, MAX_IMAGE_DIMENSION, RESIZABLE_TYPES } from '../config/constants.js';
import { sandboxPath, getAttachmentFolder, getRelativePath } from '../utils/paths.js';
import { sanitizeFilename, generateUniqueFilename } from '../utils/filename.js';

/**
 * Process an uploaded file and save it to the note's attachment folder
 */
export async function saveUpload(
  notePath: string,
  file: Express.Multer.File
): Promise<UploadResult> {
  // Validate file size
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  const mimeType = file.mimetype || lookup(file.originalname) || 'application/octet-stream';
  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed`);
  }

  // Get the full path of the note
  const noteFullPath = sandboxPath(notePath);
  if (!existsSync(noteFullPath)) {
    throw new Error('Note not found');
  }

  // Get or create attachment folder
  const attachmentFolder = getAttachmentFolder(noteFullPath);
  if (!existsSync(attachmentFolder)) {
    await mkdir(attachmentFolder, { recursive: true });
  }

  // Generate unique filename
  const ext = extname(file.originalname) || '.dat';
  const baseName = sanitizeFilename(basename(file.originalname, ext));
  const existingFiles = await readdir(attachmentFolder);
  const uniqueName = generateUniqueFilename(baseName, existingFiles, ext);

  // File is already saved by multer, we just need to return the path
  // The multer destination should be configured to save to the attachment folder
  const filePath = join(attachmentFolder, uniqueName);

  // Actually, multer saves to a temp location, we need to move it
  const { rename: renameFile } = await import('fs/promises');
  await renameFile(file.path, filePath);

  // Process image: read dimensions, constrain oversized images
  let width: number | undefined;
  let height: number | undefined;

  if (RESIZABLE_TYPES.includes(mimeType)) {
    try {
      const metadata = await sharp(filePath).metadata();
      width = metadata.width;
      height = metadata.height;

      if (width && height && (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION)) {
        const resized = await sharp(filePath)
          .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();
        await writeFile(filePath, resized);
        const newMeta = await sharp(filePath).metadata();
        width = newMeta.width;
        height = newMeta.height;
      }
    } catch {
      // If sharp fails, continue without dimensions
    }
  }

  // Return the URL path for the attachment
  const relativePath = getRelativePath(filePath);
  const url = `/api/files/${encodeURIComponent(relativePath)}`;

  return {
    url,
    filename: uniqueName,
    size: file.size,
    mimeType,
    width,
    height,
  };
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(attachmentPath: string): Promise<void> {
  const fullPath = sandboxPath(attachmentPath);

  if (!existsSync(fullPath)) {
    throw new Error('Attachment not found');
  }

  const stats = await stat(fullPath);
  if (stats.isDirectory()) {
    throw new Error('Cannot delete a directory');
  }

  await unlink(fullPath);
}

/**
 * List attachments for a note with metadata
 */
export async function listAttachments(notePath: string): Promise<AttachmentInfo[]> {
  const noteFullPath = sandboxPath(notePath);
  const attachmentFolder = getAttachmentFolder(noteFullPath);

  if (!existsSync(attachmentFolder)) {
    return [];
  }

  const entries = await readdir(attachmentFolder);
  const files = entries.filter((entry) => !entry.startsWith('.'));

  const attachments: AttachmentInfo[] = [];
  for (const filename of files) {
    const filePath = join(attachmentFolder, filename);
    const fileStat = await stat(filePath);
    const relativePath = getRelativePath(filePath);
    attachments.push({
      filename,
      size: fileStat.size,
      url: `/api/files/${encodeURIComponent(relativePath)}`,
    });
  }
  return attachments;
}

/**
 * Get the full path to an attachment folder for a note
 */
export function getAttachmentFolderPath(notePath: string): string {
  const noteFullPath = sandboxPath(notePath);
  return getAttachmentFolder(noteFullPath);
}
