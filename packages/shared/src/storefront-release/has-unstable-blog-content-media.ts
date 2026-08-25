import { builderDesignCapabilityAdapter } from '../contracts/builder-design-capability-adapter';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnstableHtmlImage(content: string): boolean {
  const mediaAttributePattern =
    /<(?:img|source)\b[^>]*\b(src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  for (const match of content.matchAll(mediaAttributePattern)) {
    const value = match[2] ?? match[3] ?? match[4];
    if (value === undefined) continue;
    const sources =
      match[1]?.toLowerCase() === 'srcset'
        ? value.split(',').map((candidate) => candidate.trim().split(/\s+/u)[0])
        : [value];
    if (sources.some((source) => !source || !isStablePublicMediaUrl(source)))
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
    return hasUnstableHtmlImage(content);
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
