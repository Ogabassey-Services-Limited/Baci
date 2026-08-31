import { decodeHtmlEntities } from './decode-html-entities';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { maskMarkdownCode } from './mask-markdown-code';

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

interface MarkdownReferenceDefinition {
  destination: string;
  label: string;
}

function readMarkdownBlockPrefix(line: string): {
  blockquoteDepth: number;
  cursor: number;
} {
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
  let blockquoteDepth = 0;
  while (line[cursor] === '>') {
    cursor += 1;
    blockquoteDepth += 1;
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
  return { blockquoteDepth, cursor };
}

function isMarkdownBlockBoundary(line: string): boolean {
  const { cursor } = readMarkdownBlockPrefix(line);
  const content = line.slice(cursor);
  return (
    content.trim().length === 0 ||
    /^#{1,6}(?:[ \t]|$)/u.test(content) ||
    /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/u.test(content)
  );
}

function scanMarkdownReferenceDefinitions(
  content: string
): MarkdownReferenceDefinition[] {
  const definitions: MarkdownReferenceDefinition[] = [];
  const recognizedDefinitionLineStarts = new Set<number>();
  let lineStart = 0;
  while (lineStart <= content.length) {
    const lineEnd = content.indexOf('\n', lineStart);
    const boundary = lineEnd === -1 ? content.length : lineEnd;
    const line = content.slice(lineStart, boundary);
    const blockPrefix = readMarkdownBlockPrefix(line);
    const openingBracket = lineStart + blockPrefix.cursor;
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
      if (/^[ \t]{1,3}\S/u.test(continuation))
        destination = parseReferenceDestination(
          content,
          continuationStart + (continuation.match(/^[ \t]*/u)?.[0].length ?? 0),
          continuationBoundary
        );
    }
    if (destination) {
      definitions.push({
        destination,
        label: content.slice(openingBracket + 1, closingBracket),
      });
      recognizedDefinitionLineStarts.add(lineStart);
    }
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }
  return definitions;
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

interface MarkdownLinkSyntax {
  destinations: Readonly<{ destination: string; image: boolean }>[];
  imageReferenceLabels: ReadonlySet<string>;
}

function normalizeMarkdownReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function isEscaped(content: string, index: number): boolean {
  let backslashCount = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && content[cursor] === '\\';
    cursor -= 1
  )
    backslashCount += 1;
  return backslashCount % 2 === 1;
}

function findNextImageToken(
  content: string,
  start: number,
  boundary = content.length
): number {
  let cursor = content.indexOf('![', start);
  while (cursor !== -1 && cursor < boundary) {
    if (!isEscaped(content, cursor)) return cursor;
    cursor = content.indexOf('![', cursor + 2);
  }
  return -1;
}

function scanMarkdownLinkSyntax(content: string): MarkdownLinkSyntax {
  const destinations: { destination: string; image: boolean }[] = [];
  const imageReferenceLabels = new Set<string>();
  let index = 0;
  while (index < content.length) {
    const image =
      content[index] === '!' &&
      content[index + 1] === '[' &&
      !isEscaped(content, index);
    if (!image && content[index] !== '[') {
      index += 1;
      continue;
    }
    const openingBracket = image ? index + 1 : index;
    const closingBracket = findBracketClose(content, openingBracket + 1);
    if (closingBracket === -1) {
      // An unmatched link label must not swallow a later image token. Markdown
      // images are independent candidates, so resume scanning at the next one
      // rather than treating its closing bracket as the outer label's close.
      const nextImage = findNextImageToken(content, openingBracket + 1);
      if (nextImage !== -1) {
        index = nextImage;
        continue;
      }
      break;
    }
    const label = content.slice(openingBracket + 1, closingBracket);
    const suffix = content[closingBracket + 1];
    if (image && suffix !== '(') {
      if (suffix === '[') {
        const referenceEnd = findBracketClose(content, closingBracket + 2);
        if (referenceEnd !== -1) {
          const explicitLabel = content.slice(closingBracket + 2, referenceEnd);
          imageReferenceLabels.add(
            normalizeMarkdownReferenceLabel(explicitLabel || label)
          );
          index = referenceEnd + 1;
          continue;
        }
      } else imageReferenceLabels.add(normalizeMarkdownReferenceLabel(label));
      index = closingBracket + 1;
      continue;
    }
    if (suffix !== '(') {
      const nestedImage = findNextImageToken(
        content,
        openingBracket + 1,
        closingBracket
      );
      if (nestedImage !== -1) {
        index = nestedImage;
        continue;
      }
      index = closingBracket + 1;
      continue;
    }
    if (!image) {
      const nestedSyntax = scanMarkdownLinkSyntax(label);
      destinations.push(...nestedSyntax.destinations);
      for (const referenceLabel of nestedSyntax.imageReferenceLabels)
        imageReferenceLabels.add(referenceLabel);
    }
    let cursor = closingBracket + 2;
    while (/\s/u.test(content[cursor] ?? '')) cursor += 1;
    const start = cursor;
    if (content[cursor] === '<') {
      const angleStart = ++cursor;
      const angleEnd = findAngleClose(content, cursor);
      if (angleEnd !== -1)
        destinations.push({
          destination: content.slice(angleStart, angleEnd),
          image,
        });
      index = angleEnd === -1 ? content.length : angleEnd + 1;
      continue;
    }
    let depth = 0;
    while (cursor < content.length) {
      const character = content[cursor] ?? '';
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '(') depth += 1;
      else if (character === ')') {
        if (depth === 0) break;
        depth -= 1;
      } else if (/\s/u.test(character) && depth === 0) break;
      cursor += 1;
    }
    destinations.push({
      destination: content.slice(start, cursor),
      image,
    });
    index = Math.max(cursor + 1, closingBracket + 1);
  }
  return { destinations, imageReferenceLabels };
}

/** Scans Markdown while ignoring fenced and inline code syntax. */
export function hasUnstableMarkdownContent(content: string): boolean {
  const scannedContent = maskMarkdownCode(content);
  const autolinkPattern = /<((?:https?:\/\/|mailto:)[^<>\r\n]+)>/giu;
  for (const match of scannedContent.matchAll(autolinkPattern)) {
    const destination = decodeHtmlEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const bareAutolinkPattern =
    /(?<![<\w])((?:https?:\/\/|mailto:|www\.)[^\s<>"']+)/giu;
  for (const match of scannedContent.matchAll(bareAutolinkPattern)) {
    const destination = decodeHtmlEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const markdown = scanMarkdownLinkSyntax(scannedContent);
  for (const inline of markdown.destinations) {
    const destination = decodeHtmlEntities(inline.destination);
    const safe = inline.image
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  for (const definition of scanMarkdownReferenceDefinitions(scannedContent)) {
    const label = normalizeMarkdownReferenceLabel(definition.label);
    const destination = decodeHtmlEntities(definition.destination);
    const safe = markdown.imageReferenceLabels.has(label)
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  return false;
}
