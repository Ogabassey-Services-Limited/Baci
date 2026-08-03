import { normalizeStorefrontCanonicalUrl } from './storefront-canonical-url';
import {
  getProductUrl,
  type StorefrontProductUrlInput,
} from './storefront-product-path';
import {
  serializeStorefrontProductPath,
  serializeStorefrontProductUrl,
} from './storefront-product-path-serialization';

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

  const finalProductPath = getProductUrl({ ...product, canonical_url: null });
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
