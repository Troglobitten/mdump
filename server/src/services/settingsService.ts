import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import type { AppSettings, UserPreferences } from '@mdump/shared';
import { DEFAULT_PREFERENCES } from '@mdump/shared';
import { SETTINGS_FILE, CONFIG_DIR } from '../config/constants.js';
import { atomicWrite } from '../utils/atomicWrite.js';

const SETTINGS_BACKUP_FILE = `${SETTINGS_FILE}.bak`;
const SETTINGS_FILE_MODE = 0o600;

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
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Parse settings JSON, returning null on failure (so callers can fall back).
 */
function tryParseSettings(content: string): AppSettings | null {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return null;
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

  // Primary file, then the one-generation backup, then defaults.
  const primary = tryParseSettings(await readFile(SETTINGS_FILE, 'utf-8').catch(() => ''));
  if (primary) {
    cachedSettings = primary;
    return primary;
  }

  console.error('settings.json missing or corrupt; attempting backup restore');
  if (existsSync(SETTINGS_BACKUP_FILE)) {
    const backup = tryParseSettings(await readFile(SETTINGS_BACKUP_FILE, 'utf-8').catch(() => ''));
    if (backup) {
      console.warn('Restored settings from backup');
      await saveSettings(backup);
      return backup;
    }
  }

  console.error('No valid settings backup; falling back to defaults');
  cachedSettings = DEFAULT_SETTINGS;
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to file (atomically, mode 0600) and refresh the backup copy.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureConfigDir();
  const serialized = JSON.stringify(settings, null, 2);
  await atomicWrite(SETTINGS_FILE, serialized, SETTINGS_FILE_MODE);
  // Keep a one-generation backup so a corrupt primary can be recovered.
  await atomicWrite(SETTINGS_BACKUP_FILE, serialized, SETTINGS_FILE_MODE);
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
