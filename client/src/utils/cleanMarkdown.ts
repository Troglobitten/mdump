/**
 * Post-process Wysimark's getMarkdown() output to remove unnecessary escapes.
 * Wysimark escapes 30+ punctuation characters that don't need escaping in markdown.
 */

// Characters that never need backslash escaping in markdown context
const SAFE_CHARS = /\\([,;?"'=\/@$%&])/g;

// &nbsp; followed by newline → just a blank line
const NBSP_NEWLINE = /&nbsp;\n/g;

export function cleanMarkdown(md: string): string {
  return md
    .replace(SAFE_CHARS, '$1')
    .replace(NBSP_NEWLINE, '\n');
}
