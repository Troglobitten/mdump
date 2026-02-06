import { Router, type Router as RouterType } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendError, sendNotFound } from '../utils/response.js';
import {
  createFolder,
  deleteFolder,
  renameFolder,
  moveFolder,
  folderExists,
  getAllFolders,
} from '../services/folderService.js';

const router: RouterType = Router();

// Apply auth to all routes
router.use(requireAuth);

/**
 * GET /api/folders
 * Get all folders as a flat list
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const folders = await getAllFolders();
    sendSuccess(res, folders);
  })
);

/**
 * POST /api/folders/*path
 * Create a new folder
 */
router.post(
  '/*',
  asyncHandler(async (req, res) => {
    const folderPath = req.params[0] || '';

    if (!folderPath) {
      sendError(res, 'Folder path is required');
      return;
    }

    const exists = await folderExists(folderPath);
    if (exists) {
      sendError(res, 'Folder already exists', 409);
      return;
    }

    const path = await createFolder(folderPath);
    sendSuccess(res, { path }, 'Folder created', 201);
  })
);

/**
 * DELETE /api/folders/*path
 * Delete a folder and its contents
 */
router.delete(
  '/*',
  asyncHandler(async (req, res) => {
    const folderPath = req.params[0] || '';

    if (!folderPath) {
      sendError(res, 'Folder path is required');
      return;
    }

    const exists = await folderExists(folderPath);
    if (!exists) {
      sendNotFound(res, 'Folder not found');
      return;
    }

    await deleteFolder(folderPath);
    sendSuccess(res, null, 'Folder deleted');
  })
);

/**
 * PATCH /api/folders/*path
 * Rename or move a folder
 */
router.patch(
  '/*',
  asyncHandler(async (req, res) => {
    const folderPath = req.params[0] || '';

    if (!folderPath) {
      sendError(res, 'Folder path is required');
      return;
    }

    const exists = await folderExists(folderPath);
    if (!exists) {
      sendNotFound(res, 'Folder not found');
      return;
    }

    const { action, newName, destination } = req.body;

    switch (action) {
      case 'rename': {
        if (!newName) {
          sendError(res, 'New name is required for rename');
          return;
        }
        const newPath = await renameFolder(folderPath, newName);
        sendSuccess(res, { path: newPath }, 'Folder renamed');
        break;
      }

      case 'move': {
        if (destination === undefined) {
          sendError(res, 'Destination is required for move');
          return;
        }
        const newPath = await moveFolder(folderPath, destination);
        sendSuccess(res, { path: newPath }, 'Folder moved');
        break;
      }

      default:
        sendError(res, 'Invalid action. Use rename or move');
    }
  })
);

export default router;
