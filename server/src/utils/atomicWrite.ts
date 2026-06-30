import { writeFile, rename, unlink } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { randomBytes } from 'crypto';

/**
 * Write a file atomically: write to a temp file in the same directory, then
 * rename it over the target. rename(2) is atomic on the same filesystem, so a
 * crash mid-write can never leave the target truncated — readers see either the
 * old file or the fully-written new one.
 *
 * @param mode Optional file mode (e.g. 0o600 for sensitive files).
 */
export async function atomicWrite(
  target: string,
  data: string | Buffer,
  mode?: number
): Promise<void> {
  const tmp = join(dirname(target), `.${basename(target)}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, data, mode !== undefined ? { mode } : undefined);
    await rename(tmp, target);
  } catch (err) {
    // Best-effort cleanup of the temp file if the rename never happened.
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
