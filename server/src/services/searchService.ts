import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';
import MiniSearch from 'minisearch';
import type { SearchResult, SearchMatch } from '@mdump/shared';
import {
  NOTES_DIR,
  SEARCH_INDEX_FILE,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_FIELDS,
  SEARCH_BOOST,
} from '../config/constants.js';
import { sandboxPath, isMarkdownFile, getRelativePath } from '../utils/paths.js';

interface IndexedDocument {
  id: string;
  path: string;
  title: string;
  content: string;
}

let searchIndex: MiniSearch<IndexedDocument> | null = null;
let indexedPaths: Set<string> = new Set();

const MINISEARCH_OPTIONS = {
  fields: SEARCH_FIELDS,
  storeFields: ['path', 'title'] as string[],
  searchOptions: {
    boost: SEARCH_BOOST,
    prefix: true,
    fuzzy: 0.2,
  },
};

/**
 * Initialize or get the search index
 */
function getSearchIndex(): MiniSearch<IndexedDocument> {
  if (!searchIndex) {
    searchIndex = new MiniSearch<IndexedDocument>(MINISEARCH_OPTIONS);
  }
  return searchIndex;
}

/**
 * Build the search index from all markdown files
 */
export async function buildIndex(): Promise<void> {
  const index = getSearchIndex();

  // Clear existing index
  index.removeAll();
  indexedPaths.clear();

  // Try to load cached index
  if (existsSync(SEARCH_INDEX_FILE)) {
    try {
      const cached = await readFile(SEARCH_INDEX_FILE, 'utf-8');
      const { data, paths } = JSON.parse(cached);
      searchIndex = MiniSearch.loadJSON<IndexedDocument>(data, MINISEARCH_OPTIONS);
      indexedPaths = new Set(paths);
      console.log(`Loaded search index with ${indexedPaths.size} documents`);
      return;
    } catch (error) {
      console.warn('Failed to load cached search index, rebuilding...');
    }
  }

  // Build index from files
  await indexDirectory('');
  await saveIndex();

  console.log(`Built search index with ${indexedPaths.size} documents`);
}

/**
 * Recursively index a directory
 */
async function indexDirectory(relativePath: string): Promise<void> {
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath)) {
    return;
  }

  const entries = await readdir(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files/folders
    if (entry.name.startsWith('.')) {
      continue;
    }

    const entryPath = relativePath ? join(relativePath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      await indexDirectory(entryPath);
    } else if (isMarkdownFile(entry.name)) {
      await indexFile(entryPath);
    }
  }
}

/**
 * Index a single file
 */
export async function indexFile(relativePath: string): Promise<void> {
  const index = getSearchIndex();
  const fullPath = sandboxPath(relativePath);

  if (!existsSync(fullPath) || !isMarkdownFile(fullPath)) {
    return;
  }

  // Remove existing document if it exists
  if (indexedPaths.has(relativePath)) {
    try {
      index.remove({ id: relativePath } as IndexedDocument);
    } catch {
      // Ignore if document doesn't exist
    }
    indexedPaths.delete(relativePath);
  }

  try {
    const content = await readFile(fullPath, 'utf-8');
    const title = basename(relativePath, extname(relativePath));

    const document: IndexedDocument = {
      id: relativePath,
      path: relativePath,
      title,
      content,
    };

    index.add(document);
    indexedPaths.add(relativePath);
  } catch (error) {
    console.error(`Failed to index file ${relativePath}:`, error);
  }
}

/**
 * Remove a file from the index
 */
export async function removeFromIndex(relativePath: string): Promise<void> {
  const index = getSearchIndex();

  if (indexedPaths.has(relativePath)) {
    try {
      index.remove({ id: relativePath } as IndexedDocument);
      indexedPaths.delete(relativePath);
    } catch {
      // Ignore if document doesn't exist
    }
  }
}

/**
 * Update a file in the index
 */
export async function updateIndex(relativePath: string): Promise<void> {
  await indexFile(relativePath);
}

/**
 * Save the search index to disk
 */
export async function saveIndex(): Promise<void> {
  const index = getSearchIndex();

  try {
    const data = JSON.stringify(index);
    const cached = JSON.stringify({
      data,
      paths: Array.from(indexedPaths),
    });
    await writeFile(SEARCH_INDEX_FILE, cached, 'utf-8');
  } catch (error) {
    console.error('Failed to save search index:', error);
  }
}

/**
 * Search the index
 */
export async function search(
  query: string,
  scope?: string,
  limit: number = SEARCH_DEFAULT_LIMIT
): Promise<SearchResult[]> {
  const index = getSearchIndex();

  if (!query || query.trim().length === 0) {
    return [];
  }

  let results = index.search(query);

  // Filter by scope if provided
  if (scope) {
    const scopePath = scope.replace(/^\/+|\/+$/g, '');
    results = results.filter((result) => result.id.startsWith(scopePath));
  }

  // Limit results
  results = results.slice(0, limit);

  return results.map((result) => {
    const matches: SearchMatch[] = [];

    // Add matches for each field
    for (const [field, positions] of Object.entries(result.match)) {
      const terms = Object.keys(positions);
      matches.push({
        field,
        snippet: terms.join(', '),
        positions: Object.values(positions).flat() as number[][],
      });
    }

    return {
      path: result.id,
      name: basename(result.id, extname(result.id)),
      matches,
      score: result.score,
    };
  });
}

/**
 * Get suggestions for autocomplete
 */
export async function getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
  const index = getSearchIndex();

  if (!prefix || prefix.trim().length === 0) {
    return [];
  }

  const results = index.autoSuggest(prefix, { prefix: true, fuzzy: false });

  return results.slice(0, limit).map((r) => r.suggestion);
}
