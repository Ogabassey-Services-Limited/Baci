import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function hasUnstableHtmlContent(content: string): boolean {
  const mediaAttributePattern =
    /<(?:img|source)\b[^>]*\b(src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of content.matchAll(mediaAttributePattern)) {
    const rawValue = match[2] ?? match[3] ?? match[4];
    if (rawValue === undefined) continue;
    const value = decodeHtmlAttributeEntities(rawValue);
    const sources =
      match[1]?.toLowerCase() === 'srcset'
        ? value.split(',').map((candidate) => candidate.trim().split(/\s+/u)[0])
        : [value];
    if (sources.some((source) => !source || !isStablePublicMediaUrl(source)))
      return true;
  }
  const linkPattern =
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of content.matchAll(linkPattern)) {
    const rawHref = match[1] ?? match[2] ?? match[3];
    const href =
      rawHref === undefined ? undefined : decodeHtmlAttributeEntities(rawHref);
    if (href !== undefined && !isSafePublicReleaseUrl(href)) return true;
  }
  return false;
}

interface MarkdownLinkSyntax {
  destinations: Readonly<{ destination: string; image: boolean }>[];
  imageReferenceLabels: ReadonlySet<string>;
}

function normalizeMarkdownReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function scanMarkdownLinkSyntax(content: string): MarkdownLinkSyntax {
  const destinations: Readonly<{
    destination: string;
    image: boolean;
  }>[] = [];
  const imageReferenceLabels = new Set<string>();
  let index = 0;
  while (index < content.length) {
    const image = content[index] === '!' && content[index + 1] === '[';
    if (!image && content[index] !== '[') {
      index += 1;
      continue;
    }
    const openingBracket = image ? index + 1 : index;
    const closingBracket = content.indexOf(']', openingBracket + 1);
    if (closingBracket === -1) break;
    const label = content.slice(openingBracket + 1, closingBracket);
    const suffix = content[closingBracket + 1];
    if (image && suffix !== '(') {
      if (suffix === '[') {
        const referenceEnd = content.indexOf(']', closingBracket + 2);
        if (referenceEnd !== -1) {
          const explicitLabel = content.slice(closingBracket + 2, referenceEnd);
          imageReferenceLabels.add(
            normalizeMarkdownReferenceLabel(explicitLabel || label)
          );
          index = referenceEnd + 1;
          continue;
        }
      } else {
        imageReferenceLabels.add(normalizeMarkdownReferenceLabel(label));
      }
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
    let end = cursor;
    if (content[cursor] === '<') {
      cursor += 1;
      const angleStart = cursor;
      while (cursor < content.length && content[cursor] !== '>') cursor += 1;
      if (content[cursor] === '>') {
        destinations.push({
          destination: content.slice(angleStart, cursor),
          image,
        });
      }
      index = cursor + 1;
      continue;
    }
    let depth = 0;
    while (cursor < content.length) {
      const character = content[cursor] ?? '';
      if (character === '\\') {
        cursor += 2;
        end = cursor;
        continue;
      }
      if (character === '(') depth += 1;
      else if (character === ')') {
        if (depth === 0) break;
        depth -= 1;
      } else if (/\s/u.test(character) && depth === 0) break;
      cursor += 1;
      end = cursor;
    }
    if (end > start)
      destinations.push({
        destination: content.slice(start, end),
        image,
      });
    index = Math.max(cursor + 1, closingBracket + 1);
  }
  return { destinations, imageReferenceLabels };
}

function hasUnstableMarkdownContent(content: string): boolean {
  const autolinkPattern = /<((?:https?:\/\/|mailto:)[^<>\r\n]+)>/giu;
  for (const match of content.matchAll(autolinkPattern)) {
    const destination = decodeHtmlAttributeEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const markdown = scanMarkdownLinkSyntax(content);
  for (const inline of markdown.destinations) {
    const destination = decodeHtmlAttributeEntities(inline.destination);
    const safe = inline.image
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  const referenceDestinationPattern =
    /^\s{0,3}\[[^\]\r\n]+\]:\s*(?:<([^>\r\n]+)>|([^\s]+))/gmu;
  for (const match of content.matchAll(referenceDestinationPattern)) {
    const label = normalizeMarkdownReferenceLabel(
      match[0].match(/^\s{0,3}\[([^\]\r\n]+)\]/u)?.[1] ?? ''
    );
    const destination = decodeHtmlAttributeEntities(match[1] ?? match[2] ?? '');
    const safe = markdown.imageReferenceLabels.has(label)
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  return false;
}

/** Detects media-bearing TipTap attributes that are unsafe for a release. */
export function hasUnstableBlogContentMedia(content: string): boolean {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return (
      hasUnstableHtmlContent(content) || hasUnstableMarkdownContent(content)
    );
  }
  if (
    (!isRecord(document) || document.type !== 'doc') &&
    (hasUnstableHtmlContent(content) || hasUnstableMarkdownContent(content))
  )
    return true;
  const pending = [document];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      for (const entry of current) pending.push(entry);
      continue;
    }
    if (!isRecord(current)) continue;
    for (const [key, value] of Object.entries(current)) {
      if (
        (key === 'src' || key === 'image') &&
        typeof value === 'string' &&
        !isStablePublicMediaUrl(value)
      )
        return true;
      if (
        key === 'href' &&
        typeof value === 'string' &&
        !isSafePublicReleaseUrl(value)
      )
        return true;
      pending.push(value);
    }
  }
  return false;
}
