import type { Response } from 'express';
import type { ApiResponse } from '@mdump/shared';

/**
 * Send a successful response
 */
export function sendSuccess<T>(res: Response, data?: T, message?: string, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(res: Response, error: string, statusCode = 400): void {
  const response: ApiResponse = {
    success: false,
    error,
  };
  res.status(statusCode).json(response);
}

/**
 * Send a not found response
 */
export function sendNotFound(res: Response, message = 'Resource not found'): void {
  sendError(res, message, 404);
}

/**
 * Send an unauthorized response
 */
export function sendUnauthorized(res: Response, message = 'Unauthorized'): void {
  sendError(res, message, 401);
}

/**
 * Send a server error response
 */
export function sendServerError(res: Response, message = 'Internal server error'): void {
  sendError(res, message, 500);
}
