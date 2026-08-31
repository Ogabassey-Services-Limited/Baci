import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { maskMarkdownCode } from './mask-markdown-code';
import { hasUnstableHtmlContent } from './scan-unstable-html-content';
import { hasUnstableMarkdownContent } from './scan-unstable-markdown-content';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnstableLegacyContent(content: string): boolean {
  const scannedContent = maskMarkdownCode(content);
  return (
    hasUnstableHtmlContent(scannedContent) ||
    hasUnstableMarkdownContent(scannedContent)
  );
}

/** Detects media-bearing TipTap attributes that are unsafe for a release. */
export function hasUnstableBlogContentMedia(content: string): boolean {
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    return hasUnstableLegacyContent(content);
  }
  if (typeof document === 'string') return hasUnstableLegacyContent(document);
  if (!isRecord(document)) return hasUnstableLegacyContent(content);
  if (document.type !== 'doc' && hasUnstableLegacyContent(content)) return true;
  const pending: unknown[] = [document];
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
