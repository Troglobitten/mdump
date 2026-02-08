/**
 * Post-process Wysimark's getMarkdown() output to remove unnecessary escapes.
 *
 * Wysimark escapes ALL 33 ASCII punctuation characters because the GFM spec
 * lists them as valid backslash-escape targets. However, many of those
 * characters have no structural markdown meaning and produce cluttered files
 * when stored escaped.
 *
 * This function removes escapes from characters that never affect markdown
 * parsing, while preserving content inside fenced code blocks and inline code
 * spans where backslashes are literal user content (Wysimark's code serializer
 * does not add escapes — any backslashes there were typed by the user).
 *
 * Characters left escaped (structural markdown meaning):
 *   \  `  *  _  [  ]  #  +  -  ~  ^  |  <  >
 */

// Characters that NEVER need backslash escaping in any markdown context.
const SAFE_ALWAYS = /\\([,;?"'=\/@$%&:{}!()])/g;

// Dot: safe to unescape EXCEPT when it would form an ordered list marker
// (digit(s) + dot at the start of a line). We unescape \. everywhere, then
// re-escape the ordered-list case in the line-level handler.
const ESCAPED_DOT = /\\\./g;

// Ordered list pattern: line starts with optional whitespace, digits, then a
// bare dot (i.e. one we just unescaped). We need to re-escape this dot.
const ORDERED_LIST = /^(\s*\d+)\./;

// &nbsp; followed by newline → just a newline (Wysimark blank-line padding)
const NBSP_NEWLINE = /&nbsp;\n/g;

/**
 * Unescape safe characters in a non-code text segment.
 */
function unescapeText(text: string): string {
  return text
    .replace(SAFE_ALWAYS, '$1')
    .replace(ESCAPED_DOT, '.');
}

/**
 * Process a single line that is NOT inside a fenced code block.
 * Identifies inline code spans (backtick-delimited) and only
 * unescapes text outside of them. Then re-escapes dots that would
 * create ordered list markers.
 */
function unescapeLine(line: string): string {
  const parts: string[] = [];
  let pos = 0;

  while (pos < line.length) {
    if (line[pos] === '`') {
      // Count opening backticks
      const backtickStart = pos;
      while (pos < line.length && line[pos] === '`') pos++;
      const backtickLen = pos - backtickStart;
      const fence = '`'.repeat(backtickLen);

      // Search for matching closing fence (exact same length, not part of a longer run)
      let closePos = line.indexOf(fence, pos);
      while (closePos !== -1) {
        const afterOk = closePos + backtickLen >= line.length || line[closePos + backtickLen] !== '`';
        const beforeOk = closePos === 0 || line[closePos - 1] !== '`';
        if (afterOk && beforeOk) break;
        closePos = line.indexOf(fence, closePos + 1);
      }

      if (closePos !== -1) {
        // Valid inline code span — include as-is (no unescaping)
        parts.push(line.slice(backtickStart, closePos + backtickLen));
        pos = closePos + backtickLen;
      } else {
        // No matching close — backticks are literal text
        parts.push(line.slice(backtickStart, pos));
      }
      continue;
    }

    // Regular text — collect until next backtick or end of line
    const textStart = pos;
    while (pos < line.length && line[pos] !== '`') pos++;
    parts.push(unescapeText(line.slice(textStart, pos)));
  }

  let result = parts.join('');

  // Re-escape dot if unescaping created an ordered list marker at line start
  // e.g. "1\." was unescaped to "1." — put the escape back
  result = result.replace(ORDERED_LIST, '$1\\.');

  return result;
}

export function cleanMarkdown(md: string): string {
  const lines = md.split('\n');
  let inFencedBlock = false;
  let fenceChar = '';
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inFencedBlock) {
      // Check for closing fence: same char, at least same length, only trailing whitespace
      const match = line.match(/^(`{3,}|~{3,})\s*$/);
      if (match && match[1][0] === fenceChar && match[1].length >= fenceLen) {
        inFencedBlock = false;
      }
      // Leave code block lines untouched
      continue;
    }

    // Check for opening fence (``` or ~~~ optionally followed by language tag)
    const match = line.match(/^(`{3,}|~{3,})/);
    if (match) {
      inFencedBlock = true;
      fenceChar = match[1][0];
      fenceLen = match[1].length;
      continue;
    }

    // Process non-code line
    lines[i] = unescapeLine(line);
  }

  return lines.join('\n').replace(NBSP_NEWLINE, '\n');
}
