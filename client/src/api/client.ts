import type {
  ApiResponse,
  AuthStatus,
  LoginCredentials,
  SetupCredentials,
  FileNode,
  FileContent,
  SearchResult,
  UserPreferences,
  TabState,
  UploadResult,
  AttachmentInfo,
  KeyboardShortcut,
} from '@mdump/shared';

const BASE_URL = '/api';

/**
 * Encode a file path for URL, preserving slashes
 */
function encodePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

// Auth API
export const authApi = {
  async getStatus(): Promise<AuthStatus> {
    const response = await fetchApi<AuthStatus>('/auth/status');
    return response.data!;
  },

  async setup(credentials: SetupCredentials): Promise<void> {
    await fetchApi('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async login(credentials: LoginCredentials): Promise<void> {
    await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async logout(): Promise<void> {
    await fetchApi('/auth/logout', { method: 'POST' });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    await fetchApi('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  },
};

// Files API
export const filesApi = {
  async getTree(): Promise<FileNode[]> {
    const response = await fetchApi<FileNode[]>('/files');
    return response.data || [];
  },

  async getFile(path: string): Promise<FileContent> {
    const response = await fetchApi<FileContent>(`/files/${encodePath(path)}`);
    return response.data!;
  },

  async createFile(path: string, content: string = ''): Promise<FileContent> {
    const response = await fetchApi<FileContent>(`/files/${encodePath(path)}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return response.data!;
  },

  async updateFile(path: string, content: string): Promise<FileContent> {
    const response = await fetchApi<FileContent>(`/files/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    return response.data!;
  },

  async deleteFile(path: string): Promise<void> {
    await fetchApi(`/files/${encodePath(path)}`, { method: 'DELETE' });
  },

  async renameFile(path: string, newName: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/files/${encodePath(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'rename', newName }),
    });
    return response.data!.path;
  },

  async moveFile(path: string, destination: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/files/${encodePath(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'move', destination }),
    });
    return response.data!.path;
  },

  async duplicateFile(path: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/files/${encodePath(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'duplicate' }),
    });
    return response.data!.path;
  },
};

// Folders API
export const foldersApi = {
  async getAll(): Promise<string[]> {
    const response = await fetchApi<string[]>('/folders');
    return response.data || [];
  },

  async create(path: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/folders/${encodePath(path)}`, {
      method: 'POST',
    });
    return response.data!.path;
  },

  async delete(path: string): Promise<void> {
    await fetchApi(`/folders/${encodePath(path)}`, { method: 'DELETE' });
  },

  async rename(path: string, newName: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/folders/${encodePath(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'rename', newName }),
    });
    return response.data!.path;
  },

  async move(path: string, destination: string): Promise<string> {
    const response = await fetchApi<{ path: string }>(`/folders/${encodePath(path)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'move', destination }),
    });
    return response.data!.path;
  },
};

// Search API
export const searchApi = {
  async search(query: string, scope?: string, limit?: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (scope) params.set('scope', scope);
    if (limit) params.set('limit', limit.toString());

    const response = await fetchApi<SearchResult[]>(`/search?${params}`);
    return response.data || [];
  },

  async reindex(): Promise<void> {
    await fetchApi('/search/reindex', { method: 'POST' });
  },

  async getSuggestions(query: string, limit?: number): Promise<string[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', limit.toString());

    const response = await fetchApi<string[]>(`/search/suggest?${params}`);
    return response.data || [];
  },
};

// Settings API
export const settingsApi = {
  async getPreferences(): Promise<UserPreferences> {
    const response = await fetchApi<UserPreferences>('/settings');
    return response.data!;
  },

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await fetchApi<UserPreferences>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return response.data!;
  },

  async getTabs(): Promise<{ openTabs: TabState[]; activeTabPath: string | null }> {
    const response = await fetchApi<{ openTabs: TabState[]; activeTabPath: string | null }>(
      '/settings/tabs'
    );
    return response.data!;
  },

  async saveTabs(openTabs: TabState[], activeTabPath: string | null): Promise<void> {
    await fetchApi('/settings/tabs', {
      method: 'PUT',
      body: JSON.stringify({ openTabs, activeTabPath }),
    });
  },

  async getShortcuts(): Promise<KeyboardShortcut[]> {
    const response = await fetchApi<KeyboardShortcut[]>('/settings/shortcuts');
    return response.data || [];
  },
};

// Upload API
export const uploadApi = {
  async upload(notePath: string, file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/upload/${encodePath(notePath)}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data: ApiResponse<UploadResult> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.data!;
  },

  async listAttachments(notePath: string): Promise<AttachmentInfo[]> {
    const response = await fetchApi<AttachmentInfo[]>(`/upload/${encodePath(notePath)}`);
    return response.data || [];
  },

  async deleteAttachment(attachmentPath: string): Promise<void> {
    await fetchApi(`/upload/${encodePath(attachmentPath)}`, { method: 'DELETE' });
  },
};
