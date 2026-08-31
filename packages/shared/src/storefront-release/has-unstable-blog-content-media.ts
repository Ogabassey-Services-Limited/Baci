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

const MAX_TIPTAP_DOCUMENT_DEPTH = 64;
const MAX_TIPTAP_DOCUMENT_NODES = 10_000;

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
  const pending: Array<{ depth: number; value: unknown }> = [
    { depth: 0, value: document },
  ];
  let visitedNodes = 0;
  while (pending.length > 0) {
    const entry = pending.pop();
    if (!entry) continue;
    visitedNodes += 1;
    if (
      visitedNodes > MAX_TIPTAP_DOCUMENT_NODES ||
      entry.depth > MAX_TIPTAP_DOCUMENT_DEPTH
    )
      return true;
    const current = entry.value;
    if (Array.isArray(current)) {
      for (const value of current)
        pending.push({ depth: entry.depth + 1, value });
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
      pending.push({ depth: entry.depth + 1, value });
    }
  }
  return false;
}
