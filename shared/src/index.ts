// Shared types between client and server

// File system types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  modifiedAt?: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  modifiedAt: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// Auth types
export interface AuthStatus {
  authenticated: boolean;
  setupComplete: boolean;
  version: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SetupCredentials extends LoginCredentials {
  confirmPassword: string;
}

// Settings types
export interface UserPreferences {
  theme: string;
  autoSave: {
    enabled: boolean;
    debounceMs: number;
    intervalMs: number;
  };
  externalChangeWarning: boolean;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  defaultView: 'tree' | 'list' | 'grid';
  paperSize: string;
  verticalSpacing: 'default' | 'compact' | 'comfortable';
  fontScale: number;
  pageWidthMode: boolean;
  printFontScale: number;
  printVerticalSpacing: 'default' | 'compact' | 'comfortable';
  debug: boolean;
  mdumpThemedEditor: boolean;
  editorFont: 'sans-serif' | 'serif' | 'monospace';
  toolbarConfig: ToolbarConfig;
}

export interface AppSettings {
  setupComplete: boolean;
  auth: {
    username: string;
    passwordHash: string;
  };
  preferences: UserPreferences;
  openTabs: TabState[];
  activeTabPath: string | null;
}

// Tab types
export interface TabState {
  path: string;
  name: string;
  isDirty: boolean;
  scrollPosition?: number;
}

// Search types
export interface SearchResult {
  path: string;
  name: string;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  field: string;
  snippet: string;
  positions?: number[][];
}

export interface SearchQuery {
  query: string;
  scope?: string;
  limit?: number;
}

// WebSocket event types
export type FileEventType = 'created' | 'modified' | 'deleted' | 'renamed';

export interface FileChangeEvent {
  type: FileEventType;
  path: string;
  oldPath?: string;
}

// Upload types
export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface AttachmentInfo {
  filename: string;
  size: number;
  url: string;
}

// Keyboard shortcut types
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
}

// Toolbar customization types
// User preferences (stored in config)
export interface ToolbarUserPreference {
  id: string;
  visible: boolean;
  order: number;
}

export interface ToolbarConfig {
  items: ToolbarUserPreference[];
}

// Constants
export const ALLOWED_FILENAME_CHARS = /^[a-zA-Z0-9\-_. ]+$/;
export const DISALLOWED_FILENAME_CHARS = /[/\\:*?"<>|]/;
export const MAX_FILENAME_LENGTH = 200;

export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  items: [
    { id: 'block-style-dropdown', visible: true, order: 0 },
    { id: 'divider-1', visible: true, order: 1 },
    { id: 'list-dropdown', visible: true, order: 2 },
    { id: 'divider-2', visible: true, order: 3 },
    { id: 'bold', visible: true, order: 4 },
    { id: 'italic', visible: true, order: 5 },
    { id: 'strikethrough', visible: true, order: 6 },
    { id: 'link', visible: true, order: 7 },
    { id: 'superscript', visible: true, order: 8 },
    { id: 'subscript', visible: true, order: 9 },
    { id: 'marker', visible: true, order: 10 },
    { id: 'latex', visible: true, order: 11 },
    { id: 'divider-3', visible: true, order: 12 },
    { id: 'file-upload', visible: true, order: 13 },
    { id: 'image', visible: true, order: 14 },
    { id: 'code-block', visible: true, order: 15 },
    { id: 'blockquote', visible: true, order: 16 },
    { id: 'horizontal-rule', visible: true, order: 17 },
    { id: 'print', visible: true, order: 18 },
  ]
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  autoSave: {
    enabled: true,
    debounceMs: 2000,
    intervalMs: 30000,
  },
  externalChangeWarning: true,
  sidebarWidth: 280,
  sidebarCollapsed: false,
  defaultView: 'tree',
  paperSize: 'A4',
  verticalSpacing: 'default',
  fontScale: 100,
  pageWidthMode: false,
  printFontScale: 100,
  printVerticalSpacing: 'default',
  debug: false,
  mdumpThemedEditor: true,
  editorFont: 'sans-serif',
  toolbarConfig: DEFAULT_TOOLBAR_CONFIG,
};
