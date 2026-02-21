const EVENT_RE = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTO_RE = /javascript\s*:/gi;
const DATA_URI_RE =
  /(?:href|src)\s*=\s*(?:"data:[^"]*"|'data:[^']*'|data:[^\s>]+)/gi;
const DANGEROUS_BLOCK_TAGS = new Set(['script', 'style', 'iframe', 'object', 'form']);
const DANGEROUS_SINGLE_TAGS = new Set(['embed', 'input']);
const DANGEROUS_TAGS = new Set([...DANGEROUS_BLOCK_TAGS, ...DANGEROUS_SINGLE_TAGS]);

function isTagNameChar(char: string | undefined): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || char === '-';
}

function findTagEnd(input: string, start: number): number {
  const end = input.indexOf('>', start);
  return end === -1 ? input.length : end + 1;
}

function parseDangerousTagAt(input: string, start: number): {
  isClosing: boolean;
  name: string;
  tagEnd: number;
} | null {
  if (input[start] !== '<') return null;

  let cursor = start + 1;
  while (input[cursor] === ' ') cursor++;

  let isClosing = false;
  if (input[cursor] === '/') {
    isClosing = true;
    cursor++;
    while (input[cursor] === ' ') cursor++;
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
    while (input[nameStart] === ' ') nameStart++;
    if (input[nameStart] !== '/') {
      cursor = open + 1;
      continue;
    }

    nameStart++;
    while (input[nameStart] === ' ') nameStart++;
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

function stripDangerousTags(input: string): string {
  const lower = input.toLowerCase();
  const out: string[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    if (input[cursor] !== '<') {
      out.push(input[cursor]);
      cursor++;
      continue;
    }

    const parsed = parseDangerousTagAt(lower, cursor);
    if (!parsed) {
      out.push(input[cursor]);
      cursor++;
      continue;
    }

    if (parsed.isClosing || DANGEROUS_SINGLE_TAGS.has(parsed.name)) {
      cursor = parsed.tagEnd;
      continue;
    }

    cursor = findClosingDangerousTagEnd(lower, parsed.name, parsed.tagEnd);
  }

  return out.join('');
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Iterative stripping: re-run until no more dangerous tags remain.
  // A single pass can be bypassed via nested-tag reconstruction (e.g. <scr<script>ipt>).
  let result = stripDangerousTags(html);
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = stripDangerousTags(result)
      .replace(EVENT_RE, '')
      .replace(JS_PROTO_RE, '')
      .replace(DATA_URI_RE, '')
      .replace(/<(\w+)\s+>/gi, '<$1>');
    result = stripDangerousTags(result);
  }
  return result;
}
