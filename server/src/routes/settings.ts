import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, preferencesSchema } from '../middleware/validation.js';
import { sendSuccess } from '../utils/response.js';
import {
  getPreferences,
  updatePreferences,
  loadSettings,
  updateSettings,
} from '../services/settingsService.js';
import { KEYBOARD_SHORTCUTS } from '../config/shortcuts.js';

const router = Router();

// Apply auth to all routes
router.use(requireAuth);

/**
 * GET /api/settings
 * Get user preferences
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const preferences = await getPreferences();
    sendSuccess(res, preferences);
  })
);

/**
 * PATCH /api/settings
 * Update user preferences
 */
router.patch(
  '/',
  validateBody(preferencesSchema),
  asyncHandler(async (req, res) => {
    const updates = req.body;
    const preferences = await updatePreferences(updates);
    sendSuccess(res, preferences, 'Settings updated');
  })
);

/**
 * GET /api/settings/tabs
 * Get saved tab state
 */
router.get(
  '/tabs',
  asyncHandler(async (req, res) => {
    const settings = await loadSettings();
    sendSuccess(res, {
      openTabs: settings.openTabs,
      activeTabPath: settings.activeTabPath,
    });
  })
);

/**
 * PUT /api/settings/tabs
 * Save tab state
 */
router.put(
  '/tabs',
  asyncHandler(async (req, res) => {
    const { openTabs, activeTabPath } = req.body;

    await updateSettings({
      openTabs: openTabs || [],
      activeTabPath: activeTabPath || null,
    });

    sendSuccess(res, null, 'Tabs saved');
  })
);

/**
 * GET /api/settings/shortcuts
 * Get keyboard shortcuts
 */
router.get('/shortcuts', (req, res) => {
  sendSuccess(res, KEYBOARD_SHORTCUTS);
});

export default router;
