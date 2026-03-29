import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';

const HTML_ATTRIBUTE_ESCAPE_REGEX = /[&<>"']/g;
const HTML_ATTRIBUTE_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtmlAttribute(value: string): string {
  return value.replace(
    HTML_ATTRIBUTE_ESCAPE_REGEX,
    (match) => HTML_ATTRIBUTE_ESCAPE_MAP[match]
  );
}

export function rewriteHtmlStorefrontHrefs(
  html: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  if (!html || !/\bhref\s*=/i.test(html)) {
    return html;
  }

  return html.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (_match, quote, href) => {
    const normalizedHref = normalizeStorefrontContentHref(href, options);
    return `href=${quote}${escapeHtmlAttribute(normalizedHref)}${quote}`;
  });
}
