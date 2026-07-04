// Quote-aware opening tag: attribute values may contain a literal `>` without
// truncating the match. Group 1 = opening-tag attributes, group 2 = inner
// content. Anchors cannot nest in valid HTML, so non-greedy inner matching is
// sufficient.
const ANCHOR_TAG_REGEX =
  /<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a\s*>/gi;
// Sequential attribute tokenizer: consuming `name="value"` / `name='value'`
// pairs left to right means href-shaped text INSIDE another attribute's value
// (e.g. title='see href="/x"') is swallowed by that attribute's token and can
// never be mistaken for the real href. Also rejects `data-href` and other
// suffixed names, since the token name must equal `href` exactly.
const ATTRIBUTE_TOKEN_REGEX =
  /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

interface HrefAttributeToken {
  index: number;
  raw: string;
  quote: '"' | "'";
  value: string;
}

function findHrefAttribute(attributes: string): HrefAttributeToken | null {
  ATTRIBUTE_TOKEN_REGEX.lastIndex = 0;
  let match = ATTRIBUTE_TOKEN_REGEX.exec(attributes);
  while (match !== null) {
    if (match[1].toLowerCase() === 'href') {
      return {
        index: match.index,
        raw: match[0],
        quote: match[3] !== undefined ? "'" : '"',
        value: match[2] ?? match[3] ?? match[4] ?? '',
      };
    }
    match = ATTRIBUTE_TOKEN_REGEX.exec(attributes);
  }
  return null;
}

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
      const hrefToken = findHrefAttribute(attributes);
      if (!hrefToken) {
        return anchor;
      }

      const href = unescapeHtmlAttribute(hrefToken.value);

      const rewrittenHref = rewriteHref?.(href);
      if (rewrittenHref && rewrittenHref !== href) {
        // Splice at the token's exact index so the replacement can only ever
        // touch the real href token, never identical text elsewhere.
        const replacement = `href=${hrefToken.quote}${escapeHtmlAttribute(rewrittenHref)}${hrefToken.quote}`;
        const newAttributes =
          attributes.slice(0, hrefToken.index) +
          replacement +
          attributes.slice(hrefToken.index + hrefToken.raw.length);
        return `<a${newAttributes}>${innerContent}</a>`;
      }

      return isDeadHref(href) ? innerContent : anchor;
    }
  );
}
