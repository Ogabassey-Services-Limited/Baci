import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';

export function rewriteHtmlStorefrontHrefs(
  html: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  if (!html || !/\bhref\s*=/i.test(html)) {
    return html;
  }

  return html.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (_match, quote, href) => {
    const normalizedHref = normalizeStorefrontContentHref(href, options);
    return `href=${quote}${normalizedHref}${quote}`;
  });
}
