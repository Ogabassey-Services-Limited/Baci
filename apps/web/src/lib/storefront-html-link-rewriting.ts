import { escapeHtmlAttribute } from '@/lib/sanitize';
import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';

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
export function rewriteHtmlStorefrontHrefs(
  html: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  if (!html || !/\bhref\s*=/i.test(html)) {
    return html;
  }

  const quotedRewritten = html.replace(
    /\bhref\s*=\s*(["'])(.*?)\1/gi,
    (_match, quote, href) => {
      const decodedHref = unescapeHtmlAttribute(href);
      const normalizedHref = normalizeStorefrontContentHref(
        decodedHref,
        options
      );
      return `href=${quote}${escapeHtmlAttribute(normalizedHref)}${quote}`;
    }
  );

  // Legacy/imported HTML can carry valid unquoted hrefs
  // (<a href=https://ogabassey.com/blog/x>). Normalize those too and re-emit
  // them quoted, so downstream dead-link/rewrite matching always sees the
  // canonical root-relative form. Quoted values were already handled above
  // and are excluded by the first character class.
  return quotedRewritten.replace(
    /\bhref\s*=\s*([^\s"'<>][^\s<>]*)/gi,
    (_match, href) => {
      const decodedHref = unescapeHtmlAttribute(href);
      const normalizedHref = normalizeStorefrontContentHref(
        decodedHref,
        options
      );
      return `href="${escapeHtmlAttribute(normalizedHref)}"`;
    }
  );
}
