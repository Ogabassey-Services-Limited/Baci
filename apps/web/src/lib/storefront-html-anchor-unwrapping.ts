// Quote-aware opening tag: attribute values may contain a literal `>` without
// truncating the match. Group 1 = opening-tag attributes, group 2 = inner
// content. Anchors cannot nest in valid HTML, so non-greedy inner matching is
// sufficient.
const ANCHOR_TAG_REGEX =
  /<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a\s*>/gi;
// The lookbehind rejects hyphen/word prefixes so `data-href`, `xlink:href`
// variants written as `something-href`, etc. are never mistaken for the real
// link target (`\b` alone matches at the `-`/`h` boundary inside data-href).
const HREF_ATTRIBUTE_REGEX = /(?<![\w-])href\s*=\s*(["'])(.*?)\1/i;

const HTML_ATTRIBUTE_ENTITY_REGEX =
  /&(?:(amp|lt|gt|quot)|#(\d+)|#x([0-9a-f]+));/gi;
const HTML_ATTRIBUTE_UNESCAPE_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
};

function unescapeHtmlAttribute(value: string): string {
  return value.replace(
    HTML_ATTRIBUTE_ENTITY_REGEX,
    (match, named: string | undefined, dec: string | undefined, hex) => {
      if (named) {
        return HTML_ATTRIBUTE_UNESCAPE_MAP[named.toLowerCase()] ?? match;
      }
      const codePoint = dec
        ? Number.parseInt(dec, 10)
        : Number.parseInt(String(hex), 16);
      return Number.isFinite(codePoint) &&
        codePoint > 0 &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
  );
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Replaces `<a>` tags whose href is reported dead by `isDeadHref` with their
 * inner content, so links to unpublished blog posts or missing products
 * degrade to plain text instead of 404 links. The href is read from the
 * opening tag's attributes only — href-shaped text inside the anchor's inner
 * content is never mistaken for the link target.
 *
 * When `rewriteHref` is provided it runs first: hrefs it maps to a canonical
 * replacement (renamed posts, consolidated/re-categorized products) are
 * rewritten in place instead of unwrapped — those targets resolve via a
 * permanent redirect, so the link works and should be fixed, not removed.
 */
export function unwrapDeadHtmlAnchors(
  html: string,
  isDeadHref: (href: string) => boolean,
  rewriteHref?: (href: string) => string | null
): string {
  if (!html || !/<a\b/i.test(html)) {
    return html;
  }

  return html.replace(
    ANCHOR_TAG_REGEX,
    (anchor, attributes: string, innerContent: string) => {
      const hrefMatch = attributes.match(HREF_ATTRIBUTE_REGEX);
      if (!hrefMatch) {
        return anchor;
      }

      const href = unescapeHtmlAttribute(hrefMatch[2]);

      const rewrittenHref = rewriteHref?.(href);
      if (rewrittenHref && rewrittenHref !== href) {
        const quote = hrefMatch[1];
        // The attribute substring appears in the opening tag, before any
        // identical text in the inner content, so first-occurrence replace
        // targets the real href.
        return anchor.replace(
          hrefMatch[0],
          `href=${quote}${escapeHtmlAttribute(rewrittenHref)}${quote}`
        );
      }

      return isDeadHref(href) ? innerContent : anchor;
    }
  );
}
