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

function getInlineMarkdownDestinations(
  content: string
): Readonly<{ destination: string; image: boolean }>[] {
  const destinations: Readonly<{
    destination: string;
    image: boolean;
  }>[] = [];
  const openingPattern = /(!?)\[[^\]\r\n]*\]\(/gu;
  for (const match of content.matchAll(openingPattern)) {
    let cursor = (match.index ?? 0) + match[0].length;
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
          image: match[1] === '!',
        });
      }
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
        image: match[1] === '!',
      });
  }
  return destinations;
}

function hasUnstableMarkdownContent(content: string): boolean {
  const autolinkPattern = /<((?:https?:\/\/|mailto:)[^<>\r\n]+)>/giu;
  for (const match of content.matchAll(autolinkPattern)) {
    const destination = decodeHtmlAttributeEntities(match[1] ?? '');
    if (!destination || !isSafePublicReleaseUrl(destination)) return true;
  }
  const imageReferenceLabels = new Set<string>();
  for (const pattern of [
    /!\[[^\]\r\n]*\]\[([^\]\r\n]+)\]/gu,
    /!\[([^\]\r\n]+)\]\[\]/gu,
    /!\[([^\]\r\n]+)\](?![[(])/gu,
  ])
    for (const match of content.matchAll(pattern))
      imageReferenceLabels.add((match[1] ?? '').trim().toLowerCase());
  for (const inline of getInlineMarkdownDestinations(content)) {
    const destination = decodeHtmlAttributeEntities(inline.destination);
    const safe = inline.image
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  const referenceDestinationPattern =
    /^\s{0,3}\[[^\]\r\n]+\]:\s*(?:<([^>\r\n]+)>|([^\s]+))/gmu;
  for (const match of content.matchAll(referenceDestinationPattern)) {
    const label = (match[0].match(/^\s{0,3}\[([^\]\r\n]+)\]/u)?.[1] ?? '')
      .trim()
      .toLowerCase();
    const destination = decodeHtmlAttributeEntities(match[1] ?? match[2] ?? '');
    const safe = imageReferenceLabels.has(label)
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
