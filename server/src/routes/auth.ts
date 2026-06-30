import { Router, type Router as RouterType, type Request } from 'express';
import rateLimit from 'express-rate-limit';
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
 * Throttle credential endpoints to slow online brute-force attacks.
 * Keys on client IP (set TRUST_PROXY when behind a reverse proxy).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later' },
});

/**
 * Regenerate the session ID before establishing an authenticated session.
 * Prevents session fixation: a pre-login (possibly attacker-planted) session ID
 * cannot survive into the authenticated session.
 */
async function establishSession(req: Request, username: string): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve()))
  );
  req.session.authenticated = true;
  req.session.username = username;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
}

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
  authLimiter,
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
    await establishSession(req, username);

    sendSuccess(res, { username }, 'Setup complete');
  })
);

/**
 * POST /api/auth/login
 * Login with credentials
 */
router.post(
  '/login',
  authLimiter,
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

    await establishSession(req, username);

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
  authLimiter,
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
