import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logger';
import { normalizeMerchantId } from '@/lib/normalize-merchant-id';
import {
  getProductScopedCacheTag,
  getProductSlugSetCacheTag,
} from '@/lib/product-cache-tags';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { buildStorefrontProductsCacheTags } from '@/lib/storefront-products-cache-key';

export interface ProductRevalidationOptions {
  feedScope?: 'all' | 'merchant' | 'none';
}

function revalidateProductTag(tag: string, profile: string): void {
  try {
    revalidateTag(tag, profile);
  } catch (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Failed to revalidate product cache tag',
      tag: sanitizeForLog(tag),
    });
  }
}

function revalidateMerchantFeed(merchantId: string): void {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped merchant feed revalidation for invalid merchant ID',
    });
    return;
  }

  revalidateProductTag('google-merchant-feed', 'products');
  revalidateProductTag('openai-product-feed', 'products');
  revalidateProductTag(`merchant-feed-${normalizedMerchantId}`, 'products');
  revalidateProductTag(
    `merchant-feed-review-signals-${normalizedMerchantId}`,
    'products'
  );
}

function revalidateProducts(
  merchantId: string,
  productSlug?: string,
  options: ProductRevalidationOptions = {}
): void {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped product cache revalidation for invalid merchant ID',
    });
    return;
  }

  revalidateProductTag(`products-${normalizedMerchantId}`, 'products');
  for (const tag of buildStorefrontProductsCacheTags(normalizedMerchantId)) {
    revalidateProductTag(tag, 'products');
  }
  const normalizedProductSlug = productSlug?.trim();
  if (normalizedProductSlug) {
    revalidateProductTag(
      getProductScopedCacheTag(
        'product',
        normalizedMerchantId,
        normalizedProductSlug
      ),
      'products'
    );
  }
  revalidateProductTag('product-details', 'products');
  revalidateProductTag('category-page-data', 'storefront-page');
  revalidateProductTag(`product-index-${normalizedMerchantId}`, 'products');
  revalidateProductTag(
    getProductSlugSetCacheTag(normalizedMerchantId),
    'products'
  );
  revalidateProductTag('product-canonical-redirect', 'products');
  revalidateProductTag('product-legacy-redirect', 'products');
  const feedScope = options.feedScope ?? 'all';
  if (feedScope === 'all') {
    revalidateMerchantFeed(normalizedMerchantId);
  } else if (feedScope === 'merchant') {
    // The merchant-scoped tag is sufficient to evict this merchant's Google
    // and OpenAI feed entries without churning every merchant's feed cache.
    revalidateProductTag(`merchant-feed-${normalizedMerchantId}`, 'products');
  }
  revalidateProductTag(`dashboard-${normalizedMerchantId}`, 'merchant');
}

function revalidateProductSlugs(
  merchantId: string,
  slugs: readonly (string | null | undefined)[]
): void {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped product slug revalidation for invalid merchant ID',
    });
    return;
  }

  const seen = new Set<string>();
  for (const rawSlug of slugs) {
    const slug = rawSlug?.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    revalidateProductTag(
      getProductScopedCacheTag('product', normalizedMerchantId, slug),
      'products'
    );
  }
}

export const productCacheRevalidation = {
  revalidateMerchantFeed,
  revalidateProductSlugs,
  revalidateProducts,
} as const;
