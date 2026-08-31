function findBracketClose(
  content: string,
  start: number,
  boundary = content.length
): number {
  let depth = 0;
  for (let index = start; index < boundary; index += 1) {
    const character = content[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (character === '[') depth += 1;
    else if (character === ']') {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function readMarkdownBlockPrefix(line: string): { cursor: number } {
  let cursor = 0;
  let leadingSpaces = 0;
  while (
    cursor < line.length &&
    leadingSpaces < 3 &&
    /[ \t]/u.test(line[cursor] ?? '')
  ) {
    cursor += 1;
    leadingSpaces += 1;
  }
  while (line[cursor] === '>') {
    cursor += 1;
    if (line[cursor] === ' ') cursor += 1;
    let quoteIndent = 0;
    while (
      cursor < line.length &&
      quoteIndent < 3 &&
      /[ \t]/u.test(line[cursor] ?? '')
    ) {
      cursor += 1;
      quoteIndent += 1;
    }
  }
  return { cursor };
}

function readReferenceContinuationStart(line: string): number | null {
  let cursor = 0;
  let leadingSpaces = 0;
  while (
    cursor < line.length &&
    leadingSpaces < 3 &&
    /[ \t]/u.test(line[cursor] ?? '')
  ) {
    cursor += 1;
    leadingSpaces += 1;
  }

  let hasBlockquote = false;
  while (line[cursor] === '>') {
    hasBlockquote = true;
    cursor += 1;
    if (line[cursor] === ' ') cursor += 1;
    const optionalNestedPrefixStart = cursor;
    let nestedPrefixSpaces = 0;
    while (
      cursor < line.length &&
      nestedPrefixSpaces < 3 &&
      /[ \t]/u.test(line[cursor] ?? '')
    ) {
      cursor += 1;
      nestedPrefixSpaces += 1;
    }
    if (line[cursor] !== '>') {
      cursor = optionalNestedPrefixStart;
      break;
    }
  }

  const indentationStart = cursor;
  while (cursor < line.length && /[ \t]/u.test(line[cursor] ?? '')) cursor += 1;
  const indentation = cursor - indentationStart;
  return indentation >= 1 &&
    indentation <= 4 &&
    (hasBlockquote || leadingSpaces >= 3)
    ? cursor
    : null;
}

function isMarkdownBlockBoundary(line: string): boolean {
  const { cursor } = readMarkdownBlockPrefix(line);
  const content = line.slice(cursor);
  const trimmed = content.trim();
  return (
    trimmed.length === 0 ||
    /^#{1,6}(?:[ \t]|$)/u.test(content) ||
    /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/u.test(content) ||
    /^=+[ \t]*$/u.test(trimmed) ||
    /^<!--[\s\S]*-->$/u.test(trimmed)
  );
}

function findAngleClose(
  content: string,
  start: number,
  boundary = content.length
): number {
  for (let index = start; index < boundary; index += 1) {
    if (content[index] === '\\') {
      index += 1;
      continue;
    }
    if (content[index] === '>') return index;
  }
  return -1;
}

function parseReferenceDestination(
  content: string,
  start: number,
  boundary: number
): string {
  let cursor = start;
  while (cursor < boundary && /[ \t\r]/u.test(content[cursor] ?? ''))
    cursor += 1;
  if (cursor >= boundary) return '';
  if (content[cursor] === '<') {
    const angleEnd = findAngleClose(content, cursor + 1, boundary);
    return angleEnd === -1 ? '' : content.slice(cursor + 1, angleEnd);
  }
  const destinationStart = cursor;
  while (cursor < boundary && !/[ \t\r]/u.test(content[cursor] ?? ''))
    cursor += 1;
  return content.slice(destinationStart, cursor);
}

function normalizeMarkdownReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Finds Markdown reference definitions, including blockquote and setext boundaries. */
export function scanMarkdownReferenceDefinitions(
  content: string
): ReadonlyArray<{ destination: string; label: string }> {
  const definitions: Array<{ destination: string; label: string }> = [];
  const recognizedDefinitionLineStarts = new Set<number>();
  let lineStart = 0;
  while (lineStart <= content.length) {
    const lineEnd = content.indexOf('\n', lineStart);
    const boundary = lineEnd === -1 ? content.length : lineEnd;
    const line = content.slice(lineStart, boundary);
    const openingBracket = lineStart + readMarkdownBlockPrefix(line).cursor;
    if (content[openingBracket] !== '[') {
      if (lineEnd === -1) break;
      lineStart = lineEnd + 1;
      continue;
    }
    if (lineStart > 0) {
      const previousLineEnd = lineStart - 1;
      const previousLineStart =
        content.lastIndexOf('\n', previousLineEnd - 1) + 1;
      const previousLine = content.slice(previousLineStart, previousLineEnd);
      if (
        !isMarkdownBlockBoundary(previousLine) &&
        !recognizedDefinitionLineStarts.has(previousLineStart) &&
        previousLine.trim().length > 0
      ) {
        if (lineEnd === -1) break;
        lineStart = lineEnd + 1;
        continue;
      }
    }
    const closingBracket = findBracketClose(
      content,
      openingBracket + 1,
      boundary
    );
    if (closingBracket === -1 || closingBracket >= boundary) {
      if (lineEnd === -1) break;
      lineStart = lineEnd + 1;
      continue;
    }
    if (content[closingBracket + 1] !== ':') {
      if (lineEnd === -1) break;
      lineStart = lineEnd + 1;
      continue;
    }
    let cursor = closingBracket + 2;
    while (cursor < boundary && /[ \t\r]/u.test(content[cursor] ?? ''))
      cursor += 1;
    let destination = '';
    if (cursor < boundary)
      destination = parseReferenceDestination(content, cursor, boundary);
    if (!destination && cursor >= boundary && lineEnd !== -1) {
      const continuationStart = lineEnd + 1;
      const continuationEnd = content.indexOf('\n', continuationStart);
      const continuationBoundary =
        continuationEnd === -1 ? content.length : continuationEnd;
      const continuation = content.slice(
        continuationStart,
        continuationBoundary
      );
      const continuationContentStart =
        readReferenceContinuationStart(continuation);
      if (continuationContentStart !== null)
        destination = parseReferenceDestination(
          content,
          continuationStart + continuationContentStart,
          continuationBoundary
        );
    }
    if (destination) {
      definitions.push({
        destination,
        label: normalizeMarkdownReferenceLabel(
          content.slice(openingBracket + 1, closingBracket)
        ),
      });
      recognizedDefinitionLineStarts.add(lineStart);
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }
  return definitions;
}
