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

// Opening tags, with quoted attribute values consumed atomically so a literal
// `>` inside a quoted value cannot end the match early.
const OPENING_TAG_REGEX = /<[a-zA-Z][^\s/>]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;

// Attribute tokens inside an opening tag. Each quoted value is consumed in
// one token, so `href=`-shaped text embedded in another attribute's value
// (e.g. title="see href=/x") can never be re-scanned as a real attribute.
const ATTRIBUTE_TOKEN_REGEX =
  /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g;

function rewriteTagHrefs(
  tag: string,
  options: NormalizeStorefrontContentHrefOptions
): string {
  return tag.replace(
    ATTRIBUTE_TOKEN_REGEX,
    (token, name: string, doubleQuoted, singleQuoted, unquoted) => {
      if (name.toLowerCase() !== 'href') {
        return token;
      }

      const rawValue = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
      const decodedHref = unescapeHtmlAttribute(rawValue);
      const normalizedHref = normalizeStorefrontContentHref(
        decodedHref,
        options
      );
      // Preserve the original quote style; unquoted values are re-emitted
      // quoted so downstream matching always sees a well-formed attribute.
      const quote = singleQuoted !== undefined ? "'" : '"';
      return `href=${quote}${escapeHtmlAttribute(normalizedHref)}${quote}`;
    }
  );
}

/**
 * Normalizes every real `href` attribute in the HTML (double-quoted,
 * single-quoted, or legacy unquoted) to its canonical storefront form.
 * Only attribute tokens inside opening tags are touched — `href=`-shaped
 * text in other attributes' values or in text content is left alone.
 */
export function rewriteHtmlStorefrontHrefs(
  html: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  if (!html || !/\bhref\s*=/i.test(html)) {
    return html;
  }

  return html.replace(OPENING_TAG_REGEX, (tag) =>
    /\bhref\s*=/i.test(tag) ? rewriteTagHrefs(tag, options) : tag
  );
}
