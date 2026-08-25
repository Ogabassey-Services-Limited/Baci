import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';
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
    if (
      href !== undefined &&
      (href.includes('?') || !builderDesignCapabilityAdapter.isSafeUrl(href))
    )
      return true;
  }
  return false;
}

/** Detects media-bearing TipTap attributes that are unsafe for a release. */
export function hasUnstableBlogContentMedia(content: string): boolean {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return hasUnstableHtmlContent(content);
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
        (value.includes('?') ||
          !builderDesignCapabilityAdapter.isSafeUrl(value))
      )
        return true;
      pending.push(value);
    }
  }
  return false;
}
