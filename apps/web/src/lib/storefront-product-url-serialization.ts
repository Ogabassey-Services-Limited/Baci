import { getStorefrontProductPath } from './get-storefront-product-path';
import { serializeStorefrontProductPath } from './serialize-storefront-product-path';
import { serializeStorefrontProductUrl } from './serialize-storefront-product-url';
import { normalizeStorefrontCanonicalUrl } from './storefront-canonical-url';
import type { StorefrontProductUrlInput } from './storefront-product-url-input';

export function getValidatedProductUrl(
  product: StorefrontProductUrlInput,
  baseUrl: string,
  merchantSlug?: string | null
): string {
  let storeOrigin = '';
  let storePathPrefix = '';
  let storeFallbackBaseUrl = '';
  try {
    const parsedBaseUrl = new URL(baseUrl);
    storeOrigin = parsedBaseUrl.origin;
    storePathPrefix = parsedBaseUrl.pathname.replace(/\/+$/, '');
    storeFallbackBaseUrl = `${storeOrigin}${storePathPrefix}`;
  } catch {
    storeOrigin = '';
    storePathPrefix = '';
    storeFallbackBaseUrl = '';
  }

  const finalProductPath = getStorefrontProductPath({
    ...product,
    canonical_url: null,
  });
  let canonicalUrl = normalizeStorefrontCanonicalUrl(
    product.canonical_url,
    storeOrigin,
    merchantSlug
  );

  if (canonicalUrl) {
    try {
      const parsedCanonicalUrl = new URL(canonicalUrl, baseUrl);
      const canonicalProductPath =
        storePathPrefix &&
        (parsedCanonicalUrl.pathname === storePathPrefix ||
          parsedCanonicalUrl.pathname.startsWith(`${storePathPrefix}/`))
          ? parsedCanonicalUrl.pathname.slice(storePathPrefix.length) || '/'
          : parsedCanonicalUrl.pathname;
      if (
        parsedCanonicalUrl.search ||
        parsedCanonicalUrl.hash ||
        serializeStorefrontProductPath(canonicalProductPath) !==
          serializeStorefrontProductPath(finalProductPath)
      ) {
        canonicalUrl = undefined;
      } else if (
        storePathPrefix &&
        parsedCanonicalUrl.pathname !== storePathPrefix &&
        !parsedCanonicalUrl.pathname.startsWith(`${storePathPrefix}/`)
      ) {
        parsedCanonicalUrl.pathname = `${storePathPrefix}${parsedCanonicalUrl.pathname}`;
        canonicalUrl = parsedCanonicalUrl.toString();
      }
    } catch {
      canonicalUrl = undefined;
    }
  }

  return serializeStorefrontProductUrl(
    canonicalUrl || `${storeFallbackBaseUrl}${finalProductPath}`
  );
}
