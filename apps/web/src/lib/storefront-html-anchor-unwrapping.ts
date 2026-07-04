const ANCHOR_TAG_REGEX = /<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi;
const HREF_ATTRIBUTE_REGEX = /\bhref\s*=\s*(["'])(.*?)\1/i;

const HTML_ATTRIBUTE_UNESCAPE_REGEX = /&(?:amp|lt|gt|quot|#39);/g;
const HTML_ATTRIBUTE_UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function unescapeHtmlAttribute(value: string): string {
  return value.replace(
    HTML_ATTRIBUTE_UNESCAPE_REGEX,
    (match) => HTML_ATTRIBUTE_UNESCAPE_MAP[match]
  );
}

/**
 * Replaces `<a>` tags whose href is reported dead by `isDeadHref` with their
 * inner content, so links to unpublished blog posts or missing products
 * degrade to plain text instead of 404 links. Anchors cannot nest in valid
 * HTML, so a non-greedy tag match is sufficient.
 */
export function unwrapDeadHtmlAnchors(
  html: string,
  isDeadHref: (href: string) => boolean
): string {
  if (!html || !/<a\b/i.test(html)) {
    return html;
  }

  return html.replace(ANCHOR_TAG_REGEX, (anchor, innerContent: string) => {
    const hrefMatch = anchor.match(HREF_ATTRIBUTE_REGEX);
    if (!hrefMatch) {
      return anchor;
    }

    const href = unescapeHtmlAttribute(hrefMatch[2]);
    return isDeadHref(href) ? innerContent : anchor;
  });
}
