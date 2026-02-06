import bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../config/constants.js';
import { loadSettings, updateSettings } from './settingsService.js';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Set up initial credentials (first-run setup)
 */
export async function setupCredentials(username: string, password: string): Promise<void> {
  const settings = await loadSettings();

  if (settings.setupComplete) {
    throw new Error('Setup has already been completed');
  }

  const passwordHash = await hashPassword(password);

  await updateSettings({
    setupComplete: true,
    auth: {
      username,
      passwordHash,
    },
  });
}

/**
 * Validate login credentials
 */
export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const settings = await loadSettings();

  if (!settings.setupComplete) {
    throw new Error('Setup has not been completed');
  }

  if (username !== settings.auth.username) {
    return false;
  }

  return verifyPassword(password, settings.auth.passwordHash);
}

/**
 * Change password for existing user
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const settings = await loadSettings();

  if (!settings.setupComplete) {
    throw new Error('Setup has not been completed');
  }

  const isValid = await verifyPassword(currentPassword, settings.auth.passwordHash);
  if (!isValid) {
    return false;
  }

  const newHash = await hashPassword(newPassword);
  await updateSettings({
    auth: {
      ...settings.auth,
      passwordHash: newHash,
    },
  });

  return true;
}

/**
 * Get the current username
 */
export async function getUsername(): Promise<string | null> {
  const settings = await loadSettings();
  return settings.setupComplete ? settings.auth.username : null;
}
