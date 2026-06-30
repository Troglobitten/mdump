import { describe, it, expect } from 'vitest';
import { validateFilename, generateUniqueFilename } from './filename.js';

describe('validateFilename', () => {
  it('accepts a normal name', () => {
    expect(validateFilename('My Note.md').valid).toBe(true);
  });

  it('rejects empty names', () => {
    expect(validateFilename('   ').valid).toBe(false);
  });

  it('rejects consecutive dots (traversal-ish)', () => {
    expect(validateFilename('a..b.md').valid).toBe(false);
  });

  it('rejects leading/trailing dots and spaces', () => {
    expect(validateFilename('.hidden').valid).toBe(false);
    expect(validateFilename('trailing.').valid).toBe(false);
    expect(validateFilename(' leading').valid).toBe(false);
  });

  it('rejects disallowed path characters', () => {
    for (const name of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b']) {
      expect(validateFilename(name).valid).toBe(false);
    }
  });

  it('rejects over-length names', () => {
    expect(validateFilename('x'.repeat(201)).valid).toBe(false);
  });
});

describe('generateUniqueFilename', () => {
  it('returns the base name when unused', () => {
    expect(generateUniqueFilename('note', [], '.md')).toBe('note.md');
  });

  it('appends a counter on collision', () => {
    expect(generateUniqueFilename('note', ['note.md'], '.md')).toBe('note-1.md');
    expect(generateUniqueFilename('note', ['note.md', 'note-1.md'], '.md')).toBe('note-2.md');
  });
});
