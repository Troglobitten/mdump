import { describe, it, expect } from 'vitest';
import { sandboxPath, isHiddenPath, isMarkdownFile } from './paths.js';
import { NOTES_DIR } from '../config/constants.js';

describe('sandboxPath', () => {
  // The security invariant: the resolved path is ALWAYS within NOTES_DIR —
  // either an absolute escape throws, or '..' sequences are stripped/neutralised
  // back into the sandbox. No input may resolve outside NOTES_DIR.
  const traversalInputs = ['../../etc/passwd', 'folder/../../escape', 'a/../../../b'];

  it('neutralises relative traversal into the sandbox', () => {
    for (const input of traversalInputs) {
      const result = sandboxPath(input);
      expect(result === NOTES_DIR || result.startsWith(NOTES_DIR + '/')).toBe(true);
    }
  });

  it('rejects absolute-path escape', () => {
    expect(() => sandboxPath('/etc/passwd')).toThrow(/traversal/i);
  });

  it('resolves a normal nested note inside the notes dir', () => {
    const result = sandboxPath('folder/note.md');
    expect(result.startsWith(NOTES_DIR + '/')).toBe(true);
    expect(result.endsWith('folder/note.md')).toBe(true);
  });
});

describe('isHiddenPath', () => {
  it('flags attachment/hidden folders', () => {
    expect(isHiddenPath('.note/image.png')).toBe(true);
    expect(isHiddenPath('folder/.attach/x.gif')).toBe(true);
  });

  it('does not flag normal paths', () => {
    expect(isHiddenPath('folder/note.md')).toBe(false);
  });
});

describe('isMarkdownFile', () => {
  it('matches .md case-insensitively', () => {
    expect(isMarkdownFile('a.md')).toBe(true);
    expect(isMarkdownFile('a.MD')).toBe(true);
    expect(isMarkdownFile('a.png')).toBe(false);
  });
});
