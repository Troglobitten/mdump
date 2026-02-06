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

// Constants
export const ALLOWED_FILENAME_CHARS = /^[a-zA-Z0-9\-_. ]+$/;
export const DISALLOWED_FILENAME_CHARS = /[/\\:*?"<>|]/;
export const MAX_FILENAME_LENGTH = 200;

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
};
