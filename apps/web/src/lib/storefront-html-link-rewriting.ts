import {
  type NormalizeStorefrontContentHrefOptions,
  normalizeStorefrontContentHref,
} from '@/lib/storefront-link-normalization';

export function rewriteHtmlStorefrontHrefs(
  html: string,
  options: NormalizeStorefrontContentHrefOptions = {}
): string {
  if (!html || !html.includes('href=')) {
    return html;
  }

  return html.replace(/\bhref=(["'])(.*?)\1/gi, (_match, quote, href) => {
    const normalizedHref = normalizeStorefrontContentHref(href, options);
    return `href=${quote}${normalizedHref}${quote}`;
  });
}
