import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { maskMarkdownCode } from './mask-markdown-code';

function decodeHtmlAttributeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/giu, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
    })
    .replace(/&#([0-9]+);?/gu, (_match, digits: string) => {
      const codePoint = Number.parseInt(digits, 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
    })
    .replace(/&quest;/giu, '?')
    .replace(/&amp;/giu, '&');
}

function findBracketClose(content: string, start: number): number {
  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
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

function findAngleClose(content: string, start: number): number {
  for (let index = start; index < content.length; index += 1) {
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
    if (closingBracket === -1) break;
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
    const destination = decodeHtmlAttributeEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const bareAutolinkPattern =
    /(?<![<\w])((?:https?:\/\/|mailto:|www\.)[^\s<>"']+)/giu;
  for (const match of scannedContent.matchAll(bareAutolinkPattern)) {
    const destination = decodeHtmlAttributeEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const markdown = scanMarkdownLinkSyntax(scannedContent);
  for (const inline of markdown.destinations) {
    const destination = decodeHtmlAttributeEntities(inline.destination);
    const safe = inline.image
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  const referenceDestinationPattern =
    /^\s{0,3}\[([^\]\r\n]+)\]:\s*(?:<([^>\r\n]+)>|([^\s]+))/gmu;
  for (const match of scannedContent.matchAll(referenceDestinationPattern)) {
    const label = normalizeMarkdownReferenceLabel(match[1] ?? '');
    const destination = decodeHtmlAttributeEntities(match[2] ?? match[3] ?? '');
    const safe = markdown.imageReferenceLabels.has(label)
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  return false;
}
