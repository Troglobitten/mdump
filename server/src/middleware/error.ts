import type { Request, Response, NextFunction } from 'express';
import { IS_PRODUCTION } from '../config/constants.js';
import { sendServerError, sendError } from '../utils/response.js';

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  // Don't expose error details in production
  const message = IS_PRODUCTION ? 'Internal server error' : err.message;

  // Check for specific error types
  if (err.message.includes('not found') || err.message.includes('Not found')) {
    sendError(res, err.message, 404);
    return;
  }

  if (err.message.includes('already exists')) {
    sendError(res, err.message, 409);
    return;
  }

  if (err.message.includes('traversal') || err.message.includes('not allowed')) {
    sendError(res, err.message, 403);
    return;
  }

  if (err.message.includes('Validation') || err.message.includes('Invalid')) {
    sendError(res, err.message, 400);
    return;
  }

  sendServerError(res, message);
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route not found: ${req.method} ${req.path}`, 404);
}

/**
 * Async route wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
