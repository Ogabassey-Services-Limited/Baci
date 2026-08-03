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
  try {
    storeOrigin = new URL(baseUrl).origin;
  } catch {
    storeOrigin = '';
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
      if (
        parsedCanonicalUrl.search ||
        parsedCanonicalUrl.hash ||
        serializeStorefrontProductPath(parsedCanonicalUrl.pathname) !==
          serializeStorefrontProductPath(finalProductPath)
      ) {
        canonicalUrl = undefined;
      }
    } catch {
      canonicalUrl = undefined;
    }
  }

  return serializeStorefrontProductUrl(
    canonicalUrl || `${storeOrigin}${finalProductPath}`
  );
}
