'use server';

import { revalidateTag } from 'next/cache';

/**
 * Invalidate merchant-related caches after updates
 */
export async function invalidateMerchantCache(
  merchantId: string,
  merchantSlug?: string
) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`merchant-id-${merchantId}`);
  if (merchantSlug) {
    // @ts-expect-error - Next.js 16 types mismatch
    revalidateTag(`merchant-${merchantSlug}`);
  }
}

/**
 * Invalidate product cache after product updates
 */
export async function invalidateProductCache(
  merchantId: string,
  productSlug?: string
) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`products-${merchantId}`);
  if (productSlug) {
    // @ts-expect-error - Next.js 16 types mismatch
    revalidateTag(`product-${merchantId}-${productSlug}`);
  }
}

/**
 * Invalidate single product cache
 */
export async function invalidateSingleProductCache(
  merchantId: string,
  productSlug: string
) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`product-${merchantId}-${productSlug}`);
}

/**
 * Invalidate category cache after category updates
 */
export async function invalidateCategoryCache(
  merchantId: string,
  categorySlug?: string
) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`categories-${merchantId}`);
  if (categorySlug) {
    // @ts-expect-error - Next.js 16 types mismatch
    revalidateTag(`category-${merchantId}-${categorySlug}`);
  }
}

/**
 * Invalidate page config cache (Puck builder)
 */
export async function invalidatePageConfigCache(
  merchantId: string,
  pageSlug: string = 'home'
) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`page-config-${merchantId}-${pageSlug}`);
}

/**
 * Invalidate product reviews cache
 */
export async function invalidateReviewsCache(productId: string) {
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`reviews-${productId}`);
  // @ts-expect-error - Next.js 16 types mismatch
  revalidateTag(`rating-stats-${productId}`);
}

/**
 * Invalidate all caches for a merchant (use sparingly)
 */
export async function invalidateAllMerchantCaches(
  merchantId: string,
  merchantSlug?: string
) {
  await invalidateMerchantCache(merchantId, merchantSlug);
  await invalidateProductCache(merchantId);
  await invalidateCategoryCache(merchantId);
  await invalidatePageConfigCache(merchantId);
}
