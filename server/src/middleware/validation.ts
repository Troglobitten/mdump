import type { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { sendError } from '../utils/response.js';

/**
 * Create a validation middleware for request body
 */
export function validateBody<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        sendError(res, `Validation error: ${message}`);
      } else {
        sendError(res, 'Validation error');
      }
    }
  };
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        sendError(res, `Validation error: ${message}`);
      } else {
        sendError(res, 'Validation error');
      }
    }
  };
}

/**
 * Create a validation middleware for URL parameters
 */
export function validateParams<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        sendError(res, `Validation error: ${message}`);
      } else {
        sendError(res, 'Validation error');
      }
    }
  };
}

// Common validation schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const setupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const fileContentSchema = z.object({
  content: z.string(),
});

export const renameSchema = z.object({
  newName: z.string().min(1, 'New name is required'),
});

export const moveSchema = z.object({
  destination: z.string(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  scope: z.string().optional(),
  limit: z.coerce.number().positive().optional(),
});

export const preferencesSchema = z.object({
  theme: z.string().optional(),
  autoSave: z.object({
    enabled: z.boolean().optional(),
    debounceMs: z.number().positive().optional(),
    intervalMs: z.number().positive().optional(),
  }).optional(),
  externalChangeWarning: z.boolean().optional(),
  sidebarWidth: z.number().positive().optional(),
  sidebarCollapsed: z.boolean().optional(),
  defaultView: z.enum(['tree', 'list', 'grid']).optional(),
}).partial();
