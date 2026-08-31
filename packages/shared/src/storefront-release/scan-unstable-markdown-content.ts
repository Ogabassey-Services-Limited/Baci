import { decodeHtmlEntities } from './decode-html-entities';
import { isSafePublicReleaseUrl } from './is-safe-public-release-url';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';
import { maskMarkdownCode } from './mask-markdown-code';
import { scanMarkdownLinks } from './scan-markdown-links';

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
  const markdown = scanMarkdownLinks(scannedContent);
  for (const inline of markdown.destinations) {
    const destination = decodeHtmlEntities(inline.destination);
    const safe = inline.image
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  for (const definition of markdown.referenceDefinitions) {
    const destination = decodeHtmlEntities(definition.destination);
    const safe = markdown.imageReferenceLabels.has(definition.label)
      ? isStablePublicMediaUrl(destination)
      : isSafePublicReleaseUrl(destination);
    if (!destination || !safe) return true;
  }
  return false;
}
