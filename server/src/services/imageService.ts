import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { IMAGE_CACHE_DIR } from '../config/constants.js';

/**
 * Get a resized version of an image, using disk cache
 */
export async function getResizedImage(
  originalPath: string,
  w: number,
  h: number
): Promise<Buffer> {
  // Build cache key from path + dimensions
  const hash = createHash('sha256')
    .update(`${originalPath}:${w}x${h}`)
    .digest('hex');
  const cachedPath = join(IMAGE_CACHE_DIR, `${hash}.bin`);

  // Check cache: cached file must exist and be newer than original
  if (existsSync(cachedPath)) {
    const [cachedStat, originalStat] = await Promise.all([
      stat(cachedPath),
      stat(originalPath),
    ]);
    if (cachedStat.mtimeMs >= originalStat.mtimeMs) {
      return readFile(cachedPath);
    }
  }

  // Resize with sharp
  const buffer = await sharp(originalPath)
    .resize(w, h, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  // Write to cache
  if (!existsSync(IMAGE_CACHE_DIR)) {
    await mkdir(IMAGE_CACHE_DIR, { recursive: true });
  }
  await writeFile(cachedPath, buffer);

  return buffer;
}

/**
 * Clear the image cache directory
 */
export async function clearImageCache(): Promise<number> {
  if (!existsSync(IMAGE_CACHE_DIR)) {
    return 0;
  }

  const entries = await readdir(IMAGE_CACHE_DIR);
  for (const entry of entries) {
    await unlink(join(IMAGE_CACHE_DIR, entry));
  }
  return entries.length;
}

/**
 * Get total size of the image cache in bytes
 */
export async function getImageCacheSize(): Promise<number> {
  if (!existsSync(IMAGE_CACHE_DIR)) {
    return 0;
  }

  const entries = await readdir(IMAGE_CACHE_DIR);
  let total = 0;
  for (const entry of entries) {
    const s = await stat(join(IMAGE_CACHE_DIR, entry));
    total += s.size;
  }
  return total;
}
