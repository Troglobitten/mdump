import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, fileContentSchema, renameSchema, moveSchema } from '../middleware/validation.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import {
  getFileTree,
  readFileContent,
  createFile,
  updateFile,
  deleteFile,
  renameFile,
  moveFile,
  duplicateFile,
  fileExists,
  getFileMetadata,
} from '../services/fileService.js';
import { getResizedImage } from '../services/imageService.js';
import { sandboxPath, isMarkdownFile } from '../utils/paths.js';
import { NOTES_DIR, RESIZABLE_TYPES } from '../config/constants.js';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { lookup } from 'mime-types';

const router = Router();

// Apply auth to all routes
router.use(requireAuth);

/**
 * GET /api/files
 * Get the file tree
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tree = await getFileTree();
    sendSuccess(res, tree);
  })
);

/**
 * GET /api/files/*path
 * Get file content or serve attachment
 */
router.get(
  '/*',
  asyncHandler(async (req, res) => {
    const filePath = req.params[0] || '';

    if (!filePath) {
      const tree = await getFileTree();
      sendSuccess(res, tree);
      return;
    }

    try {
      const fullPath = sandboxPath(filePath);

      if (!existsSync(fullPath)) {
        sendNotFound(res, 'File not found');
        return;
      }

      // If it's a markdown file, return the content as JSON
      if (isMarkdownFile(fullPath)) {
        const fileContent = await readFileContent(filePath);
        sendSuccess(res, fileContent);
        return;
      }

      // For other files (attachments), serve them directly
      const mimeType = lookup(fullPath) || 'application/octet-stream';

      // Check for resize query params
      const wParam = req.query.w;
      const hParam = req.query.h;
      if (wParam && hParam && RESIZABLE_TYPES.includes(mimeType)) {
        const w = parseInt(wParam as string, 10);
        const h = parseInt(hParam as string, 10);
        if (w > 0 && h > 0 && w <= 4096 && h <= 4096) {
          const resized = await getResizedImage(fullPath, w, h);
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Length', resized.length);
          res.setHeader('Cache-Control', 'private, max-age=31536000');
          res.send(resized);
          return;
        }
      }

      const stats = await stat(fullPath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'private, max-age=31536000');

      const content = await readFile(fullPath);
      res.send(content);
    } catch (error) {
      if (error instanceof Error && error.message.includes('traversal')) {
        sendError(res, error.message, 403);
        return;
      }
      throw error;
    }
  })
);

/**
 * POST /api/files/*path
 * Create a new file
 */
router.post(
  '/*',
  validateBody(fileContentSchema.partial()),
  asyncHandler(async (req, res) => {
    const filePath = req.params[0] || '';

    if (!filePath) {
      sendError(res, 'File path is required');
      return;
    }

    const { content = '' } = req.body;

    try {
      const exists = await fileExists(filePath);
      if (exists) {
        sendError(res, 'File already exists', 409);
        return;
      }

      const fileContent = await createFile(filePath, content);
      sendSuccess(res, fileContent, 'File created', 201);
    } catch (error) {
      throw error;
    }
  })
);

/**
 * PUT /api/files/*path
 * Update file content
 */
router.put(
  '/*',
  validateBody(fileContentSchema),
  asyncHandler(async (req, res) => {
    const filePath = req.params[0] || '';

    if (!filePath) {
      sendError(res, 'File path is required');
      return;
    }

    const { content } = req.body;

    const exists = await fileExists(filePath);
    if (!exists) {
      sendNotFound(res, 'File not found');
      return;
    }

    const fileContent = await updateFile(filePath, content);
    sendSuccess(res, fileContent, 'File updated');
  })
);

/**
 * DELETE /api/files/*path
 * Delete a file
 */
router.delete(
  '/*',
  asyncHandler(async (req, res) => {
    const filePath = req.params[0] || '';

    if (!filePath) {
      sendError(res, 'File path is required');
      return;
    }

    const exists = await fileExists(filePath);
    if (!exists) {
      sendNotFound(res, 'File not found');
      return;
    }

    await deleteFile(filePath);
    sendSuccess(res, null, 'File deleted');
  })
);

/**
 * PATCH /api/files/*path
 * Rename, move, or duplicate a file
 */
router.patch(
  '/*',
  asyncHandler(async (req, res) => {
    const filePath = req.params[0] || '';

    if (!filePath) {
      sendError(res, 'File path is required');
      return;
    }

    const exists = await fileExists(filePath);
    if (!exists) {
      sendNotFound(res, 'File not found');
      return;
    }

    const { action, newName, destination } = req.body;

    switch (action) {
      case 'rename': {
        if (!newName) {
          sendError(res, 'New name is required for rename');
          return;
        }
        const newPath = await renameFile(filePath, newName);
        sendSuccess(res, { path: newPath }, 'File renamed');
        break;
      }

      case 'move': {
        if (destination === undefined) {
          sendError(res, 'Destination is required for move');
          return;
        }
        const newPath = await moveFile(filePath, destination);
        sendSuccess(res, { path: newPath }, 'File moved');
        break;
      }

      case 'duplicate': {
        const newPath = await duplicateFile(filePath);
        sendSuccess(res, { path: newPath }, 'File duplicated');
        break;
      }

      default:
        sendError(res, 'Invalid action. Use rename, move, or duplicate');
    }
  })
);

export default router;
