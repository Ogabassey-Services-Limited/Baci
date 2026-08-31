const HTML_BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'pre',
  'script',
  'section',
  'search',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'textarea',
  'title',
  'tr',
  'track',
  'ul',
  'style',
]);
const RAW_HTML_TAGS = new Set(['pre', 'script', 'style', 'textarea']);

function blankRange(chars: string[], start: number, end: number): void {
  for (let index = start; index < end; index += 1)
    if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
}

function findHtmlTagEnd(content: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < content.length; index += 1) {
    const character = content[index];
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index;
  }
  return -1;
}

function isBlockHtmlStart(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1;
  let cursor = lineStart;
  let spaces = 0;
  while (cursor < index && content[cursor] === ' ' && spaces < 3) {
    cursor += 1;
    spaces += 1;
  }
  while (cursor < index && content[cursor] === '>') {
    cursor += 1;
    if (content[cursor] === ' ') cursor += 1;
    spaces = 0;
    while (cursor < index && content[cursor] === ' ' && spaces < 3) {
      cursor += 1;
      spaces += 1;
    }
  }
  return cursor === index;
}

function findHtmlClosingTag(
  content: string,
  tagName: string,
  start: number
): number {
  const lowerContent = content.toLowerCase();
  const closingPrefix = `</${tagName}`;
  let cursor = start;
  while (cursor < content.length) {
    const candidate = lowerContent.indexOf(closingPrefix, cursor);
    if (candidate === -1) return -1;
    const boundary = content[candidate + closingPrefix.length] ?? '';
    if (boundary === '>' || /[ \t\r\n]/u.test(boundary)) return candidate;
    cursor = candidate + closingPrefix.length;
  }
  return -1;
}

function findHtmlBlankLine(content: string, start: number): number {
  let cursor = start;
  while (cursor < content.length) {
    const lineEnd = content.indexOf('\n', cursor);
    if (lineEnd === -1) return -1;
    let next = lineEnd + 1;
    while (next < content.length && /[ \t]/u.test(content[next] ?? ''))
      next += 1;
    if (content[next] === '\n') return next + 1;
    cursor = lineEnd + 1;
  }
  return -1;
}

/** Masks HTML blocks so Markdown syntax inside them is not treated as live. */
export function maskMarkdownHtmlBlocks(content: string): string {
  const chars = content.split('');
  let index = 0;
  while (index < content.length) {
    if (content.startsWith('<!--', index)) {
      const commentEnd = content.indexOf('-->', index + 4);
      const end = commentEnd === -1 ? content.length : commentEnd + 3;
      blankRange(chars, index, end);
      index = end;
      continue;
    }
    if (
      content[index] !== '<' ||
      !isBlockHtmlStart(content, index) ||
      content[index + 1] === '/' ||
      content[index + 1] === '!' ||
      content[index + 1] === '?'
    ) {
      index += 1;
      continue;
    }
    const tagMatch = /^<([A-Za-z][A-Za-z0-9:-]*)\b/u.exec(content.slice(index));
    const tagName = tagMatch?.[1]?.toLowerCase();
    if (!tagName || !HTML_BLOCK_TAGS.has(tagName)) {
      index += 1;
      continue;
    }
    const openingEnd = findHtmlTagEnd(content, index);
    if (openingEnd === -1) {
      blankRange(chars, index, content.length);
      break;
    }
    const closingStart = findHtmlClosingTag(content, tagName, openingEnd + 1);
    let end = content.length;
    if (closingStart !== -1) {
      const closingEnd = findHtmlTagEnd(content, closingStart);
      if (closingEnd !== -1) end = closingEnd + 1;
    }
    if (!RAW_HTML_TAGS.has(tagName)) {
      const blankLine = findHtmlBlankLine(content, openingEnd + 1);
      if (blankLine !== -1 && (closingStart === -1 || blankLine < closingStart))
        end = blankLine;
    }
    blankRange(chars, index, Math.max(index, end));
    index = Math.max(index + 1, end);
  }
  return chars.join('');
}
