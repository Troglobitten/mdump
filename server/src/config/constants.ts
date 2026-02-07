import { resolve } from 'path';
import { readFileSync } from 'fs';

// Version (read from root package.json)
function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}
export const VERSION = getVersion();

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

// Paths
export const DATA_DIR = process.env.DATA_DIR || resolve(process.cwd(), 'data');
export const NOTES_DIR = process.env.NOTES_DIR || resolve(DATA_DIR, 'notes');
export const CONFIG_DIR = resolve(DATA_DIR, 'config');
export const SESSIONS_DIR = resolve(CONFIG_DIR, 'sessions');
export const SETTINGS_FILE = resolve(CONFIG_DIR, 'settings.json');
export const SEARCH_INDEX_FILE = resolve(DATA_DIR, '.search-index.json');

// Server
export const PORT = parseInt(process.env.PORT || '8080', 10);
export const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';

// Auth
export const BCRYPT_ROUNDS = 10;
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Files
export const MAX_FILENAME_LENGTH = 200;
export const ALLOWED_FILENAME_REGEX = /^[a-zA-Z0-9\-_. ]+$/;
export const DISALLOWED_CHARS_REGEX = /[/\\:*?"<>|]/;
export const HIDDEN_FOLDER_PREFIX = '.';
export const MARKDOWN_EXTENSION = '.md';

// Upload
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-tar',
  'application/gzip',
  'application/json',
  'application/xml',
  'application/octet-stream',
];

// Image processing
export const MAX_IMAGE_DIMENSION = 2560;
export const IMAGE_CACHE_DIR = resolve(DATA_DIR, '.image-cache');
export const RESIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Search
export const SEARCH_DEFAULT_LIMIT = 50;
export const SEARCH_FIELDS = ['title', 'content', 'path'];
export const SEARCH_BOOST = { title: 2, content: 1, path: 0.5 };

// WebSocket
export const WS_PING_INTERVAL = 30000;
