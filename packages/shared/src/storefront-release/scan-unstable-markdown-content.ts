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

function scanMarkdownReferenceDefinitions(
  content: string
): MarkdownReferenceDefinition[] {
  const definitions: MarkdownReferenceDefinition[] = [];
  const definitionStartPattern = /^\s{0,3}\[/gmu;
  for (const match of content.matchAll(definitionStartPattern)) {
    const openingBracket = (match.index ?? 0) + match[0].length - 1;
    const lineEnd = content.indexOf('\n', openingBracket + 1);
    const boundary = lineEnd === -1 ? content.length : lineEnd;
    const closingBracket = findBracketClose(
      content,
      openingBracket + 1,
      boundary
    );
    if (closingBracket === -1 || closingBracket >= boundary) continue;
    if (content[closingBracket + 1] !== ':') continue;
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
    if (destination)
      definitions.push({
        destination,
        label: content.slice(openingBracket + 1, closingBracket),
      });
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

function scanMarkdownLinkSyntax(content: string): MarkdownLinkSyntax {
  const destinations: { destination: string; image: boolean }[] = [];
  const imageReferenceLabels = new Set<string>();
  let index = 0;
  while (index < content.length) {
    const image = content[index] === '!' && content[index + 1] === '[';
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
      const nextImage = content.indexOf('![', openingBracket + 1);
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
      index = closingBracket + 1;
      continue;
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
    if (cursor > start)
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
