import { cacheLife, cacheTag } from 'next/cache';
import {
  getPublicSupabaseClient,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';

type StorefrontProductImageRecord = {
  images?: unknown;
};

const PRODUCT_LCP_IMAGE_COLUMNS = `
  id,
  slug,
  images
`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCachedStorefrontProductLcpImage(
  merchantId: string,
  productSlug: string
): Promise<string | null> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'product',
    'product-lcp-image',
    `product-lcp-image-${merchantId}-${productSlug}`
  );

  const supabase = getPublicSupabaseClient();
  const isUuid = UUID_PATTERN.test(productSlug);

  let query = supabase
    .from('products')
    .select(PRODUCT_LCP_IMAGE_COLUMNS)
    .eq('merchant_id', merchantId)
    .eq('status', 'active');

  if (isUuid) {
    query = query.or(`slug.eq.${productSlug},id.eq.${productSlug}`);
  } else {
    query = query.eq('slug', productSlug.toLowerCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(
      'Error fetching product LCP image:',
      sanitizeLookupLogValue(productSlug),
      error
    );
    return null;
  }

  return getPrimaryImageUrl(data);
}

function getPrimaryImageUrl(
  product: StorefrontProductImageRecord | null
): string | null {
  if (!product) return null;

  const { images } = product;
  if (typeof images === 'string' && images.trim()) {
    return images;
  }

  if (!Array.isArray(images)) {
    return null;
  }

  return images.map(getImageUrlCandidate).find(Boolean) ?? null;
}

function getImageUrlCandidate(image: unknown): string | null {
  if (typeof image === 'string' && image.trim()) {
    return image;
  }

  if (
    image &&
    typeof image === 'object' &&
    'url' in image &&
    typeof image.url === 'string' &&
    image.url.trim()
  ) {
    return image.url;
  }

  return null;
}
