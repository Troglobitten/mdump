import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// NOTES_DIR is resolved from env at module import, so point it at a temp dir
// BEFORE importing the service (which pulls in constants).
let dir: string;
let svc: typeof import('./fileService.js');

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mdump-filesvc-'));
  process.env.DATA_DIR = dir;
  process.env.NOTES_DIR = dir;
  svc = await import('./fileService.js');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('updateFile optimistic concurrency', () => {
  it('succeeds when no expectedModifiedAt is supplied', async () => {
    const created = await svc.createFile('no-token.md', 'v0');
    const result = await svc.updateFile('no-token.md', 'v1');
    expect(result.content).toBe('v1');
    expect(result.modifiedAt).not.toBe(''); // fresh mtime returned
    expect(created.path).toBe('no-token.md');
  });

  it('succeeds when expectedModifiedAt matches the on-disk version', async () => {
    const created = await svc.createFile('match.md', 'v0');
    const result = await svc.updateFile('match.md', 'v1', created.modifiedAt);
    expect(result.content).toBe('v1');
  });

  it('throws ConflictError when expectedModifiedAt is stale', async () => {
    await svc.createFile('conflict.md', 'v0');
    const stale = new Date(0).toISOString(); // definitely not the current mtime
    await expect(svc.updateFile('conflict.md', 'v1', stale)).rejects.toBeInstanceOf(
      svc.ConflictError
    );
  });
});
