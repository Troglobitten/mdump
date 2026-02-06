import type { Request, Response, NextFunction } from 'express';
import { sendUnauthorized } from '../utils/response.js';
import { isSetupComplete } from '../services/settingsService.js';

// Extend Express session types
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

/**
 * Middleware to check if the user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
  } else {
    sendUnauthorized(res, 'Authentication required');
  }
}

/**
 * Middleware to check if setup is complete
 * Used to protect routes that require a configured app
 */
export async function requireSetup(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const setupComplete = await isSetupComplete();

  if (setupComplete) {
    next();
  } else {
    sendUnauthorized(res, 'Setup has not been completed');
  }
}

/**
 * Middleware to redirect to setup if not complete
 */
export async function checkSetup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const setupComplete = await isSetupComplete();

  if (!setupComplete && !req.path.startsWith('/api/auth/setup')) {
    res.status(403).json({
      success: false,
      error: 'Setup required',
      setupRequired: true,
    });
  } else {
    next();
  }
}
