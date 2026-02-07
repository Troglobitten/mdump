import { Router, type Router as RouterType } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { validateBody, loginSchema, setupSchema, changePasswordSchema } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendError, sendUnauthorized } from '../utils/response.js';
import {
  setupCredentials,
  validateCredentials,
  changePassword,
} from '../services/authService.js';
import { isSetupComplete } from '../services/settingsService.js';
import { VERSION } from '../config/constants.js';

const router: RouterType = Router();

/**
 * GET /api/auth/status
 * Check authentication status and setup state
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const setupComplete = await isSetupComplete();
    const authenticated = req.session?.authenticated || false;

    sendSuccess(res, {
      authenticated,
      setupComplete,
      version: VERSION,
      username: authenticated ? req.session?.username : null,
    });
  })
);

/**
 * POST /api/auth/setup
 * First-run credential setup
 */
router.post(
  '/setup',
  validateBody(setupSchema),
  asyncHandler(async (req, res) => {
    const setupComplete = await isSetupComplete();

    if (setupComplete) {
      sendError(res, 'Setup has already been completed', 403);
      return;
    }

    const { username, password } = req.body;

    await setupCredentials(username, password);

    // Auto-login after setup
    req.session.authenticated = true;
    req.session.username = username;

    sendSuccess(res, { username }, 'Setup complete');
  })
);

/**
 * POST /api/auth/login
 * Login with credentials
 */
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const setupComplete = await isSetupComplete();

    if (!setupComplete) {
      sendError(res, 'Setup has not been completed', 403);
      return;
    }

    const { username, password } = req.body;
    const valid = await validateCredentials(username, password);

    if (!valid) {
      sendUnauthorized(res, 'Invalid credentials');
      return;
    }

    req.session.authenticated = true;
    req.session.username = username;

    sendSuccess(res, { username }, 'Login successful');
  })
);

/**
 * POST /api/auth/logout
 * Logout current session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      sendError(res, 'Failed to logout', 500);
      return;
    }

    res.clearCookie('connect.sid');
    sendSuccess(res, null, 'Logout successful');
  });
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const changed = await changePassword(currentPassword, newPassword);

    if (!changed) {
      sendError(res, 'Current password is incorrect');
      return;
    }

    sendSuccess(res, null, 'Password changed successfully');
  })
);

export default router;
