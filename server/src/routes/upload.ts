import { Router, type Router as RouterType } from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { saveUpload, listAttachments, deleteAttachment } from '../services/uploadService.js';
import { DATA_DIR, MAX_UPLOAD_SIZE } from '../config/constants.js';

const router: RouterType = Router();

// Ensure upload temp directory exists
const uploadDir = join(DATA_DIR, 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
  },
});

// Apply auth to all routes
router.use(requireAuth);

/**
 * POST /api/upload/*notePath
 * Upload an attachment for a note
 */
router.post(
  '/*',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const notePath = req.params[0] || '';

    if (!notePath) {
      sendError(res, 'Note path is required');
      return;
    }

    if (!req.file) {
      sendError(res, 'No file uploaded');
      return;
    }

    try {
      const result = await saveUpload(notePath, req.file);
      sendSuccess(res, result, 'File uploaded', 201);
    } catch (error) {
      // Clean up temp file on error
      const { unlink } = await import('fs/promises');
      try {
        await unlink(req.file.path);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  })
);

/**
 * GET /api/upload/*notePath
 * List attachments for a note
 */
router.get(
  '/*',
  asyncHandler(async (req, res) => {
    const notePath = req.params[0] || '';

    if (!notePath) {
      sendError(res, 'Note path is required');
      return;
    }

    const attachments = await listAttachments(notePath);
    sendSuccess(res, attachments);
  })
);

/**
 * DELETE /api/upload/*attachmentPath
 * Delete an attachment
 */
router.delete(
  '/*',
  asyncHandler(async (req, res) => {
    const attachmentPath = req.params[0] || '';

    if (!attachmentPath) {
      sendError(res, 'Attachment path is required');
      return;
    }

    await deleteAttachment(attachmentPath);
    sendSuccess(res, null, 'Attachment deleted');
  })
);

export default router;
