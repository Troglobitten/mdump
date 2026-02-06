import { Router, type Router as RouterType } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery, searchQuerySchema } from '../middleware/validation.js';
import { sendSuccess } from '../utils/response.js';
import { search, getSuggestions, buildIndex, saveIndex } from '../services/searchService.js';

const router: RouterType = Router();

// Apply auth to all routes
router.use(requireAuth);

/**
 * GET /api/search
 * Search notes by query
 */
router.get(
  '/',
  validateQuery(searchQuerySchema),
  asyncHandler(async (req, res) => {
    const { q, scope, limit } = req.query as unknown as {
      q: string;
      scope?: string;
      limit?: number;
    };

    const results = await search(q, scope, limit);
    sendSuccess(res, results);
  })
);

/**
 * GET /api/search/suggest
 * Get search suggestions for autocomplete
 */
router.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query as { q?: string; limit?: string };

    if (!q) {
      sendSuccess(res, []);
      return;
    }

    const suggestions = await getSuggestions(q, limit ? parseInt(limit, 10) : undefined);
    sendSuccess(res, suggestions);
  })
);

/**
 * POST /api/search/reindex
 * Rebuild the search index
 */
router.post(
  '/reindex',
  asyncHandler(async (_req, res) => {
    await buildIndex();
    await saveIndex();
    sendSuccess(res, { message: 'Search index rebuilt' });
  })
);

export default router;
