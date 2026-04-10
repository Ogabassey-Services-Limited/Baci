const DANGEROUS_TAGS = new Set([
  'script',
  'style',
  'foreignobject',
  'iframe',
  'object',
  'embed',
]);

const DANGEROUS_PAIR_TAGS = new Set([
  'script',
  'style',
  'foreignobject',
  'iframe',
  'object',
]);

const URI_ATTR_NAMES = new Set(['href', 'src', 'xlink:href']);

type AttrQuote = '"' | "'" | null;

interface ParsedTag {
  name: string;
  rawName: string;
  nameEnd: number;
  isClosing: boolean;
  isSelfClosing: boolean;
}

interface ParsedAttribute {
  name: string;
  value: string | null;
  quote: AttrQuote;
}

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isTagNameChar(ch: string): boolean {
  return /[a-z0-9:-]/i.test(ch);
}

function skipWhitespace(input: string, index: number): number {
  let i = index;
  while (i < input.length && isWhitespace(input[i])) i++;
  return i;
}

function findTagEnd(input: string, start: number): number {
  let quote: AttrQuote = null;
  for (let i = start + 1; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return i;
  }
  return -1;
}

function parseTag(
  input: string,
  tagStart: number,
  tagEnd: number
): ParsedTag | null {
  let i = tagStart + 1;
  i = skipWhitespace(input, i);

  let isClosing = false;
  if (i < tagEnd && input[i] === '/') {
    isClosing = true;
    i++;
    i = skipWhitespace(input, i);
  }

  const nameStart = i;
  while (i < tagEnd && isTagNameChar(input[i])) i++;
  if (i === nameStart) return null;

  let slashProbe = tagEnd - 1;
  while (slashProbe > tagStart && isWhitespace(input[slashProbe])) slashProbe--;

  return {
    name: input.slice(nameStart, i).toLowerCase(),
    rawName: input.slice(nameStart, i),
    nameEnd: i,
    isClosing,
    isSelfClosing: !isClosing && input[slashProbe] === '/',
  };
}

function parseAttributes(
  rawTag: string,
  attrStart: number,
  tagEnd: number
): ParsedAttribute[] {
  const attrs: ParsedAttribute[] = [];
  let i = attrStart;

  while (i < tagEnd) {
    i = skipWhitespace(rawTag, i);
    if (i >= tagEnd) break;
    if (rawTag[i] === '/') {
      i++;
      continue;
    }

    const nameStart = i;
    while (
      i < tagEnd &&
      !isWhitespace(rawTag[i]) &&
      rawTag[i] !== '=' &&
      rawTag[i] !== '/' &&
      rawTag[i] !== '>' &&
      rawTag[i] !== '<'
    ) {
      i++;
    }

    if (i === nameStart) {
      i++;
      continue;
    }

    const name = rawTag.slice(nameStart, i);
    i = skipWhitespace(rawTag, i);

    let value: string | null = null;
    let quote: AttrQuote = null;

    if (i < tagEnd && rawTag[i] === '=') {
      i++;
      i = skipWhitespace(rawTag, i);

      if (i >= tagEnd) {
        value = '';
      } else if (rawTag[i] === '"' || rawTag[i] === "'") {
        quote = rawTag[i] as AttrQuote;
        i++;
        const valueStart = i;
        while (i < tagEnd && rawTag[i] !== quote) i++;
        value = rawTag.slice(valueStart, i);
        if (i < tagEnd) i++;
      } else {
        const valueStart = i;
        while (
          i < tagEnd &&
          !isWhitespace(rawTag[i]) &&
          rawTag[i] !== '/' &&
          rawTag[i] !== '>' &&
          rawTag[i] !== '<'
        ) {
          i++;
        }
        value = rawTag.slice(valueStart, i);
      }
    }

    attrs.push({ name, value, quote });
  }

  return attrs;
}

function rebuildTag(
  rawName: string,
  attrs: ParsedAttribute[],
  isSelfClosing: boolean
): string {
  let out = `<${rawName}`;

  for (const attr of attrs) {
    if (attr.value === null) {
      out += ` ${attr.name}`;
      continue;
    }

    if (attr.quote === "'") {
      out += ` ${attr.name}='${attr.value}'`;
      continue;
    }

    if (attr.quote === '"') {
      out += ` ${attr.name}="${attr.value}"`;
      continue;
    }

    out += ` ${attr.name}=${attr.value}`;
  }

  out += isSelfClosing ? '/>' : '>';
  return out;
}

function normalizeAttrValue(value: string): string {
  return value.trim().replace(/\r/g, '').replace(/\n/g, '');
}

function sanitizeUriValue(value: string): string {
  const normalized = normalizeAttrValue(value);
  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '';
  }
  return value;
}

function isExternalUseReference(value: string): boolean {
  const lower = normalizeAttrValue(value).toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//')
  );
}

function sanitizeStartTag(rawTag: string): string {
  const tagEnd = rawTag.length - 1;
  const parsed = parseTag(rawTag, 0, tagEnd);
  if (!parsed || parsed.isClosing) return rawTag;

  const attrs = parseAttributes(rawTag, parsed.nameEnd, tagEnd);
  const sanitizedAttrs: ParsedAttribute[] = [];

  for (const attr of attrs) {
    const lowerName = attr.name.toLowerCase();

    if (lowerName.startsWith('on')) {
      continue;
    }

    if (parsed.name === 'use' && URI_ATTR_NAMES.has(lowerName) && attr.value) {
      if (isExternalUseReference(attr.value)) {
        return '';
      }
    }

    if (URI_ATTR_NAMES.has(lowerName) && attr.value !== null) {
      const sanitizedValue = sanitizeUriValue(attr.value);
      const quote = attr.quote ?? '"';
      sanitizedAttrs.push({
        name: attr.name,
        value: sanitizedValue,
        quote,
      });
      continue;
    }

    sanitizedAttrs.push(attr);
  }

  return rebuildTag(parsed.rawName, sanitizedAttrs, parsed.isSelfClosing);
}

function stripDangerousTagStarts(input: string): string {
  const lower = input.toLowerCase();
  const dangerous = [...DANGEROUS_TAGS];
  const outParts: string[] = [];

  let i = 0;
  while (i < input.length) {
    if (input[i] === '<') {
      let j = i + 1;
      while (j < lower.length && isWhitespace(lower[j])) j++;
      if (j < lower.length && lower[j] === '/') {
        j++;
        while (j < lower.length && isWhitespace(lower[j])) j++;
      }

      let matched = false;
      for (const name of dangerous) {
        if (lower.startsWith(name, j)) {
          const k = j + name.length;
          if (k >= lower.length || !/[a-z0-9-]/.test(lower[k])) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        const close = findTagEnd(input, i);
        if (close === -1) break;
        i = close + 1;
        continue;
      }
    }

    outParts.push(input[i]);
    i++;
  }

  return outParts.join('');
}

function findDangerousCloseEnd(
  input: string,
  from: number,
  dangerousTag: string
): number {
  let depth = 1;
  let i = from;

  while (i < input.length) {
    const nextOpen = input.indexOf('<', i);
    if (nextOpen === -1) return input.length;

    const nextClose = findTagEnd(input, nextOpen);
    if (nextClose === -1) return input.length;

    const parsed = parseTag(input, nextOpen, nextClose);
    if (parsed && parsed.name === dangerousTag) {
      if (parsed.isClosing) {
        depth--;
      } else if (!parsed.isSelfClosing) {
        depth++;
      }

      if (depth === 0) {
        return nextClose + 1;
      }
    }

    i = nextClose + 1;
  }

  return input.length;
}

function findEmbeddedDangerousStart(rawTag: string): string | null {
  const lower = rawTag.toLowerCase();
  let quote: AttrQuote = null;

  for (let i = 1; i < lower.length; i++) {
    const ch = lower[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch !== '<') continue;

    let j = i + 1;
    while (j < lower.length && isWhitespace(lower[j])) j++;
    if (j < lower.length && lower[j] === '/') {
      j++;
      while (j < lower.length && isWhitespace(lower[j])) j++;
    }

    for (const name of DANGEROUS_PAIR_TAGS) {
      if (lower.startsWith(name, j)) {
        const k = j + name.length;
        if (k >= lower.length || !/[a-z0-9-]/.test(lower[k])) {
          return name;
        }
      }
    }
  }

  return null;
}

/**
 * Sanitize SVG by stripping dangerous elements and attributes.
 * Removes: <script>, <style>, <foreignObject>, <iframe>, <embed>, <object> tags,
 * event handlers (on*), javascript: URIs, data: URIs, and
 * <use> elements with external references.
 */
export function sanitizeSvg(svg: string): string {
  if (svg.length === 0) return '';

  const outParts: string[] = [];
  let i = 0;

  while (i < svg.length) {
    const nextTag = svg.indexOf('<', i);
    if (nextTag === -1) {
      outParts.push(svg.slice(i));
      break;
    }

    outParts.push(svg.slice(i, nextTag));

    const tagEnd = findTagEnd(svg, nextTag);
    if (tagEnd === -1) {
      outParts.push(stripDangerousTagStarts(svg.slice(nextTag)));
      break;
    }

    const rawTag = svg.slice(nextTag, tagEnd + 1);
    const embeddedDangerousStart = findEmbeddedDangerousStart(rawTag);
    if (embeddedDangerousStart) {
      const nextMarkup = svg.indexOf('<', tagEnd + 1);
      i = nextMarkup === -1 ? svg.length : nextMarkup;
      continue;
    }

    const parsed = parseTag(svg, nextTag, tagEnd);

    if (!parsed) {
      outParts.push(rawTag);
      i = tagEnd + 1;
      continue;
    }

    if (DANGEROUS_TAGS.has(parsed.name)) {
      if (
        !parsed.isClosing &&
        DANGEROUS_PAIR_TAGS.has(parsed.name) &&
        !parsed.isSelfClosing
      ) {
        i = findDangerousCloseEnd(svg, tagEnd + 1, parsed.name);
      } else {
        i = tagEnd + 1;
      }
      continue;
    }

    if (parsed.isClosing) {
      outParts.push(rawTag);
      i = tagEnd + 1;
      continue;
    }

    const sanitizedTag = sanitizeStartTag(rawTag);
    if (sanitizedTag) outParts.push(sanitizedTag);
    i = tagEnd + 1;
  }

  return stripDangerousTagStarts(outParts.join(''));
}
