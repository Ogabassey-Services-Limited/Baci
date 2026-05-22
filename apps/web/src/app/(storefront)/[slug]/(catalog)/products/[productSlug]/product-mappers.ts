import { getProductUrl } from '@/lib/seo-utils';
import type { normalizeStorefrontProductVariants } from '@/lib/storefront-product-variants';

export type RawProductImage =
  | string
  | {
      url: string;
      alt?: string;
      order?: number;
    };

export type StorefrontProductVariants = Parameters<
  typeof normalizeStorefrontProductVariants
>[0];

export interface CanonicalUrlCandidate {
  canonical_url?: string | null;
  category?: string | null;
  category_slug?: string | null;
  condition?: string | null;
  condition_detail?: string | null;
  id: string;
  name: string;
  slug?: string | null;
}

function normalizeRoutePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

export function getMappedCanonicalUrl(
  product: CanonicalUrlCandidate
): string | undefined {
  const canonicalUrl = product.canonical_url?.trim();
  if (!canonicalUrl) {
    return undefined;
  }

  let canonicalPath: string;
  try {
    canonicalPath = new URL(canonicalUrl, 'https://storefront.invalid')
      .pathname;
  } catch {
    return undefined;
  }

  const productForUrl = {
    id: product.id,
    name: product.name,
    slug: product.slug || undefined,
    category: product.category || undefined,
    category_slug: product.category_slug || undefined,
    condition: product.condition || undefined,
    condition_detail: product.condition_detail || undefined,
  };
  const expectedPath = normalizeRoutePath(
    getProductUrl({ ...productForUrl, canonical_url: null })
  );
  const mappedCanonicalPath = normalizeRoutePath(
    getProductUrl({ ...productForUrl, canonical_url: canonicalUrl })
  );
  const normalizedCanonicalPath = normalizeRoutePath(canonicalPath);

  if (mappedCanonicalPath !== expectedPath) {
    return undefined;
  }

  if (
    normalizedCanonicalPath !== mappedCanonicalPath &&
    !normalizedCanonicalPath.endsWith(mappedCanonicalPath)
  ) {
    return undefined;
  }

  return mappedCanonicalPath;
}

export function normalizeProductImages(
  productName: string,
  rawImages: RawProductImage[] | null | undefined
) {
  return rawImages?.map((img, idx) => {
    if (typeof img === 'string') {
      return { url: img, alt: productName, order: idx };
    }

    return {
      url: img.url,
      alt: img.alt || productName,
      order: img.order ?? idx,
    };
  });
}
