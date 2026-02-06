import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { AppSettings, UserPreferences } from '@mdump/shared';
import { DEFAULT_PREFERENCES } from '@mdump/shared';
import { SETTINGS_FILE, CONFIG_DIR } from '../config/constants.js';

const DEFAULT_SETTINGS: AppSettings = {
  setupComplete: false,
  auth: {
    username: '',
    passwordHash: '',
  },
  preferences: DEFAULT_PREFERENCES,
  openTabs: [],
  activeTabPath: null,
};

let cachedSettings: AppSettings | null = null;

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load settings from file, creating default settings if none exist
 */
export async function loadSettings(): Promise<AppSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }

  await ensureConfigDir();

  if (!existsSync(SETTINGS_FILE)) {
    await saveSettings(DEFAULT_SETTINGS);
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }

  try {
    const content = await readFile(SETTINGS_FILE, 'utf-8');
    cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    return cachedSettings!;
  } catch (error) {
    console.error('Error loading settings:', error);
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to file
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureConfigDir();
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  cachedSettings = settings;
}

/**
 * Update specific settings
 */
export async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const updated = { ...current, ...updates };
  await saveSettings(updated);
  return updated;
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await loadSettings();
  const updatedPreferences = { ...current.preferences, ...updates };
  await updateSettings({ preferences: updatedPreferences });
  return updatedPreferences;
}

/**
 * Get current preferences
 */
export async function getPreferences(): Promise<UserPreferences> {
  const settings = await loadSettings();
  return settings.preferences;
}

/**
 * Check if setup is complete
 */
export async function isSetupComplete(): Promise<boolean> {
  const settings = await loadSettings();
  return settings.setupComplete;
}

/**
 * Clear the settings cache (useful for testing)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
}
