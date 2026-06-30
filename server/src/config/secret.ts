import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { CONFIG_DIR } from './constants.js';

const SECRET_FILE = join(CONFIG_DIR, '.session-secret');
const LEGACY_DEFAULT = 'change-me-in-production';

/**
 * Resolve the session signing secret, in priority order:
 *   1. SESSION_SECRET env var (ignoring the old insecure default)
 *   2. A previously-persisted random secret on disk
 *   3. A freshly-generated random secret, persisted with mode 0600
 *
 * This guarantees sessions are never signed with a publicly-known value, while
 * keeping zero-config deployments working (no manual secret required) and
 * stable across restarts.
 */
export function resolveSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv !== LEGACY_DEFAULT) {
    return fromEnv;
  }

  if (existsSync(SECRET_FILE)) {
    const persisted = readFileSync(SECRET_FILE, 'utf-8').trim();
    if (persisted) {
      return persisted;
    }
  }

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const generated = randomBytes(48).toString('base64');
  writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  console.warn(
    'No SESSION_SECRET provided (or it was the insecure default); generated and persisted a random secret to config.'
  );
  return generated;
}
