import { revalidateTag } from 'next/cache';
import { getCategoryPageDataCacheTag } from '@/lib/category-page-cache-tags';
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

function revalidateProductTag(tag: string, profile: string): boolean {
  try {
    revalidateTag(tag, profile);
    return true;
  } catch (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Failed to revalidate product cache tag',
      tag: sanitizeForLog(tag),
    });
    return false;
  }
}

function revalidateMerchantFeed(merchantId: string): boolean {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped merchant feed revalidation for invalid merchant ID',
    });
    return false;
  }

  return [
    revalidateProductTag('google-merchant-feed', 'products'),
    revalidateProductTag('openai-product-feed', 'products'),
    revalidateProductTag(`merchant-feed-${normalizedMerchantId}`, 'products'),
    revalidateProductTag(
      `merchant-feed-review-signals-${normalizedMerchantId}`,
      'products'
    ),
  ].every(Boolean);
}

function revalidateDashboard(merchantId: string): void {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped dashboard cache revalidation for invalid merchant ID',
    });
    return;
  }

  revalidateProductTag(`dashboard-${normalizedMerchantId}`, 'merchant');
}

function revalidateProducts(
  merchantId: string,
  productSlug?: string,
  options: ProductRevalidationOptions = {}
): boolean {
  const normalizedMerchantId = normalizeMerchantId(merchantId);
  if (!normalizedMerchantId) {
    logger.warn({
      merchantId: sanitizeForLog(merchantId),
      message: 'Skipped product cache revalidation for invalid merchant ID',
    });
    return false;
  }

  const results = [
    revalidateProductTag(`products-${normalizedMerchantId}`, 'products'),
  ];
  for (const tag of buildStorefrontProductsCacheTags(normalizedMerchantId)) {
    results.push(revalidateProductTag(tag, 'products'));
  }
  const normalizedProductSlug = productSlug?.trim();
  if (normalizedProductSlug) {
    results.push(
      revalidateProductTag(
        getProductScopedCacheTag(
          'product',
          normalizedMerchantId,
          normalizedProductSlug
        ),
        'products'
      )
    );
  }
  results.push(revalidateProductTag('product-details', 'products'));
  results.push(
    revalidateProductTag(
      getCategoryPageDataCacheTag(normalizedMerchantId),
      'storefront-page'
    )
  );
  results.push(
    revalidateProductTag(`product-index-${normalizedMerchantId}`, 'products')
  );
  results.push(
    revalidateProductTag(
      getProductSlugSetCacheTag(normalizedMerchantId),
      'products'
    )
  );
  results.push(revalidateProductTag('product-canonical-redirect', 'products'));
  results.push(revalidateProductTag('product-legacy-redirect', 'products'));
  const feedScope = options.feedScope ?? 'all';
  if (feedScope === 'all') {
    results.push(revalidateMerchantFeed(normalizedMerchantId));
  } else if (feedScope === 'merchant') {
    // The merchant-scoped tag is sufficient to evict this merchant's Google
    // and OpenAI feed entries without churning every merchant's feed cache.
    results.push(
      revalidateProductTag(`merchant-feed-${normalizedMerchantId}`, 'products')
    );
  }
  results.push(
    revalidateProductTag(`dashboard-${normalizedMerchantId}`, 'merchant')
  );
  return results.every(Boolean);
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
  revalidateDashboard,
  revalidateMerchantFeed,
  revalidateProductSlugs,
  revalidateProducts,
} as const;
