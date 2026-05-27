const UNSAFE_URI_PREFIXES = ['javascript:', 'data:', 'vbscript:', 'blob:'] as const;
const MAX_UNSAFE_URI_PREFIX_LENGTH = Math.max(
  ...UNSAFE_URI_PREFIXES.map((prefix) => prefix.length)
);
const MAX_STRIP_ITERATIONS = 50;

function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
}

function isAsciiControlChar(char: string | undefined): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code <= 0x1f || code === 0x7f;
}

export function stripUnsafeUriPrefix(value: string): string {
  let result = value.trimStart();
  let iterations = 0;

  while (iterations < MAX_STRIP_ITERATIONS) {
    iterations++;
    let cursor = 0;
    while (cursor < result.length && isWhitespace(result[cursor])) cursor++;

    let candidate = '';
    let scan = cursor;
    while (scan < result.length && candidate.length < MAX_UNSAFE_URI_PREFIX_LENGTH) {
      if (!isAsciiControlChar(result[scan])) {
        candidate += result[scan].toLowerCase();
      }
      scan++;
    }

    const matchedPrefix = UNSAFE_URI_PREFIXES.find((prefix) =>
      candidate.startsWith(prefix)
    );
    if (!matchedPrefix) return result;

    let consumedNormalizedChars = 0;
    let removalEnd = cursor;
    while (removalEnd < result.length && consumedNormalizedChars < matchedPrefix.length) {
      if (!isAsciiControlChar(result[removalEnd])) {
        consumedNormalizedChars++;
      }
      removalEnd++;
    }

    result = `${result.slice(0, cursor)}${result.slice(removalEnd)}`.trimStart();
  }

  return result;
}
