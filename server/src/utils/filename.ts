import {
  ALLOWED_FILENAME_REGEX,
  DISALLOWED_CHARS_REGEX,
  MAX_FILENAME_LENGTH,
} from '../config/constants.js';

export interface FilenameValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a filename according to the app's naming rules
 */
export function validateFilename(filename: string): FilenameValidationResult {
  if (!filename || filename.trim().length === 0) {
    return { valid: false, error: 'Filename cannot be empty' };
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `Filename cannot exceed ${MAX_FILENAME_LENGTH} characters` };
  }

  if (filename.startsWith(' ') || filename.endsWith(' ')) {
    return { valid: false, error: 'Filename cannot start or end with spaces' };
  }

  if (filename.startsWith('.') || filename.endsWith('.')) {
    return { valid: false, error: 'Filename cannot start or end with dots' };
  }

  if (filename.includes('..')) {
    return { valid: false, error: 'Filename cannot contain consecutive dots' };
  }

  if (DISALLOWED_CHARS_REGEX.test(filename)) {
    return { valid: false, error: 'Filename contains disallowed characters (/ \\ : * ? " < > |)' };
  }

  // Remove the extension for the regex check
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  if (!ALLOWED_FILENAME_REGEX.test(nameWithoutExt)) {
    return {
      valid: false,
      error: 'Filename can only contain letters, numbers, hyphens, underscores, dots, and spaces',
    };
  }

  return { valid: true };
}

/**
 * Sanitize a filename by removing or replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove disallowed characters
  let sanitized = filename.replace(DISALLOWED_CHARS_REGEX, '-');

  // Replace multiple spaces/hyphens with single ones
  sanitized = sanitized.replace(/[\s-]+/g, '-');

  // Remove leading/trailing spaces and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

  // Truncate if too long
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_FILENAME_LENGTH);
  }

  // If nothing remains, use a default
  if (!sanitized) {
    sanitized = 'untitled';
  }

  return sanitized;
}

/**
 * Generate a unique filename by appending a number if needed
 */
export function generateUniqueFilename(
  baseName: string,
  existingNames: string[],
  extension: string = ''
): string {
  const fullName = extension ? `${baseName}${extension}` : baseName;

  if (!existingNames.includes(fullName)) {
    return fullName;
  }

  let counter = 1;
  let uniqueName: string;

  do {
    uniqueName = extension ? `${baseName}-${counter}${extension}` : `${baseName}-${counter}`;
    counter++;
  } while (existingNames.includes(uniqueName));

  return uniqueName;
}
