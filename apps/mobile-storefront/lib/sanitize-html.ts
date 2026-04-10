const DANGEROUS_BLOCK_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'form',
]);
const DANGEROUS_SINGLE_TAGS = new Set(['embed', 'input']);
const DANGEROUS_TAGS = new Set([
  ...DANGEROUS_BLOCK_TAGS,
  ...DANGEROUS_SINGLE_TAGS,
]);
const UNSAFE_URI_PREFIXES = [
  'javascript:',
  'data:',
  'vbscript:',
  'blob:',
] as const;
const ALLOWED_ATTRIBUTES = new Set([
  'class',
  'style',
  'href',
  'src',
  'alt',
  'title',
  'xlink:href',
  'formaction',
]);
const MAX_SANITIZE_PASSES = 12;
const MAX_UNSAFE_URI_PREFIX_LENGTH = Math.max(
  ...UNSAFE_URI_PREFIXES.map((prefix) => prefix.length)
);

function isWhitespace(char: string | undefined): boolean {
  return (
    char === ' ' ||
    char === '\n' ||
    char === '\r' ||
    char === '\t' ||
    char === '\f'
  );
}

function isTagNameChar(char: string | undefined): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === '-'
  );
}

function isAsciiControlChar(char: string | undefined): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code <= 0x1f || code === 0x7f;
}

function findTagEnd(input: string, start: number): number {
  let quote: '"' | "'" | null = null;
  let cursor = start;
  while (cursor < input.length) {
    const char = input[cursor];
    if (quote) {
      if (char === quote) quote = null;
      cursor++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      cursor++;
      continue;
    }

    if (char === '>') return cursor + 1;
    cursor++;
  }

  return input.length;
}

function parseDangerousTagAt(
  input: string,
  start: number
): {
  isClosing: boolean;
  name: string;
  tagEnd: number;
} | null {
  if (input[start] !== '<') return null;

  let cursor = start + 1;
  while (isWhitespace(input[cursor])) cursor++;

  let isClosing = false;
  if (input[cursor] === '/') {
    isClosing = true;
    cursor++;
    while (isWhitespace(input[cursor])) cursor++;
  }

  const nameStart = cursor;
  while (isTagNameChar(input[cursor])) cursor++;
  if (cursor === nameStart) return null;

  const name = input.slice(nameStart, cursor);
  if (!DANGEROUS_TAGS.has(name)) return null;

  return { isClosing, name, tagEnd: findTagEnd(input, cursor) };
}

function findClosingDangerousTagEnd(
  input: string,
  tagName: string,
  searchStart: number
): number {
  let cursor = searchStart;
  while (cursor < input.length) {
    const open = input.indexOf('<', cursor);
    if (open === -1) return searchStart;

    let nameStart = open + 1;
    while (isWhitespace(input[nameStart])) nameStart++;
    if (input[nameStart] !== '/') {
      cursor = open + 1;
      continue;
    }

    nameStart++;
    while (isWhitespace(input[nameStart])) nameStart++;
    if (!input.startsWith(tagName, nameStart)) {
      cursor = open + 1;
      continue;
    }

    const afterName = nameStart + tagName.length;
    if (isTagNameChar(input[afterName])) {
      cursor = open + 1;
      continue;
    }

    return findTagEnd(input, afterName);
  }

  return searchStart;
}

function stripUnsafeUriPrefix(value: string): string {
  let result = value;
  let cursor = 0;
  while (cursor < result.length && isWhitespace(result[cursor])) cursor++;

  while (true) {
    let candidate = '';
    let scan = cursor;
    while (
      scan < result.length &&
      candidate.length < MAX_UNSAFE_URI_PREFIX_LENGTH
    ) {
      if (!isAsciiControlChar(result[scan])) {
        candidate += result[scan].toLowerCase();
      }
      scan++;
    }

    let matchedPrefix: (typeof UNSAFE_URI_PREFIXES)[number] | null = null;
    for (const prefix of UNSAFE_URI_PREFIXES) {
      if (candidate.startsWith(prefix)) {
        matchedPrefix = prefix;
        break;
      }
    }

    if (!matchedPrefix) {
      return result;
    }

    let consumedNormalizedChars = 0;
    let removalEnd = cursor;
    while (
      removalEnd < result.length &&
      consumedNormalizedChars < matchedPrefix.length
    ) {
      if (!isAsciiControlChar(result[removalEnd])) {
        consumedNormalizedChars++;
      }
      removalEnd++;
    }

    result = `${result.slice(0, cursor)}${result.slice(removalEnd)}`;
  }
}

function sanitizeSafeTag(rawTag: string): string {
  if (
    rawTag.length < 3 ||
    rawTag[0] !== '<' ||
    rawTag[rawTag.length - 1] !== '>'
  ) {
    return rawTag;
  }

  const lowerTag = rawTag.toLowerCase();
  let cursor = 1;
  while (isWhitespace(lowerTag[cursor])) cursor++;

  let isClosing = false;
  if (lowerTag[cursor] === '/') {
    isClosing = true;
    cursor++;
    while (isWhitespace(lowerTag[cursor])) cursor++;
  }

  const nameStart = cursor;
  while (isTagNameChar(lowerTag[cursor])) cursor++;
  if (cursor === nameStart) return rawTag;

  const name = lowerTag.slice(nameStart, cursor);
  if (isClosing) return `</${name}>`;

  const sanitizedAttributes: string[] = [];
  while (cursor < rawTag.length - 1) {
    while (cursor < rawTag.length - 1 && isWhitespace(lowerTag[cursor]))
      cursor++;
    if (cursor >= rawTag.length - 1) break;

    if (
      rawTag[cursor] === '/' ||
      rawTag[cursor] === '>' ||
      rawTag[cursor] === '<'
    ) {
      break;
    }

    const attrNameStart = cursor;
    while (
      cursor < rawTag.length - 1 &&
      !isWhitespace(lowerTag[cursor]) &&
      rawTag[cursor] !== '=' &&
      rawTag[cursor] !== '/' &&
      rawTag[cursor] !== '>' &&
      rawTag[cursor] !== '<'
    ) {
      cursor++;
    }
    if (cursor === attrNameStart) {
      cursor++;
      continue;
    }

    const attrName = rawTag.slice(attrNameStart, cursor);
    const lowerAttrName = attrName.toLowerCase();

    while (cursor < rawTag.length - 1 && isWhitespace(lowerTag[cursor]))
      cursor++;

    let hasValue = false;
    let quote: '"' | "'" | '' = '';
    let value = '';

    if (rawTag[cursor] === '=') {
      hasValue = true;
      cursor++;
      while (cursor < rawTag.length - 1 && isWhitespace(lowerTag[cursor]))
        cursor++;

      const maybeQuote = rawTag[cursor];
      if (maybeQuote === '"' || maybeQuote === "'") {
        quote = maybeQuote;
        cursor++;
        const valueStart = cursor;
        while (cursor < rawTag.length - 1 && rawTag[cursor] !== quote) cursor++;
        value = rawTag.slice(valueStart, cursor);
        if (rawTag[cursor] === quote) cursor++;
      } else {
        const valueStart = cursor;
        while (
          cursor < rawTag.length - 1 &&
          !isWhitespace(lowerTag[cursor]) &&
          rawTag[cursor] !== '>'
        ) {
          cursor++;
        }
        value = rawTag.slice(valueStart, cursor);
      }
    }

    // Known limitation: this text-level sanitizer does not decode HTML entities,
    // so entity-encoded attribute names/values may bypass these checks.
    // A full fix requires entity decoding or a DOM-based parser.
    if (!ALLOWED_ATTRIBUTES.has(lowerAttrName)) continue;

    let sanitizedValue = value;
    if (
      lowerAttrName === 'href' ||
      lowerAttrName === 'src' ||
      lowerAttrName === 'xlink:href' ||
      lowerAttrName === 'formaction'
    ) {
      sanitizedValue = stripUnsafeUriPrefix(value);
    }

    if (!hasValue) {
      sanitizedAttributes.push(attrName);
      continue;
    }

    if (quote) {
      sanitizedAttributes.push(`${attrName}=${quote}${sanitizedValue}${quote}`);
      continue;
    }

    sanitizedAttributes.push(`${attrName}=${sanitizedValue}`);
  }

  const isSelfClosing = rawTag.slice(0, -1).trimEnd().endsWith('/');
  const attrs =
    sanitizedAttributes.length > 0 ? ` ${sanitizedAttributes.join(' ')}` : '';

  return isSelfClosing ? `<${name}${attrs}/>` : `<${name}${attrs}>`;
}

function sanitizeTags(input: string): string {
  const lower = input.toLowerCase();
  const out: string[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    if (input[cursor] !== '<') {
      out.push(input[cursor]);
      cursor++;
      continue;
    }

    const dangerous = parseDangerousTagAt(lower, cursor);
    if (dangerous) {
      if (dangerous.isClosing || DANGEROUS_SINGLE_TAGS.has(dangerous.name)) {
        cursor = dangerous.tagEnd;
        continue;
      }

      cursor = findClosingDangerousTagEnd(
        lower,
        dangerous.name,
        dangerous.tagEnd
      );
      continue;
    }

    const tagEnd = findTagEnd(input, cursor + 1);
    const rawTag = input.slice(cursor, tagEnd);
    if (rawTag.length === 1) {
      out.push('<');
      cursor++;
      continue;
    }

    out.push(sanitizeSafeTag(rawTag));
    cursor = tagEnd;
  }

  return out.join('');
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Iterate until stable so nested-tag reconstruction cannot reintroduce dangerous tags.
  let result = html;
  let previous = '';
  let passes = 0;
  const maxPasses = MAX_SANITIZE_PASSES;
  while (result !== previous && passes < maxPasses) {
    previous = result;
    result = sanitizeTags(result);
    passes++;
  }

  return result;
}
