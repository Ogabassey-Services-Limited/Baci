import { revalidateTag } from 'next/cache';
import { getCategoryPageDataCacheTag } from '@/lib/category-page-cache-tags';

/**
 * Revalidate the cached category surfaces for a merchant.
 *
 * Lives in its own module, separate from `cache-revalidation.ts`, because that
 * module imports `cloudflare-purge` — which reads `getCloudflareApiToken` and
 * therefore counts as a credential-authority reach. Any NEW API route importing
 * it inherits that reach and fails the event-pipeline boundary gate
 * (`verify-event-pipeline-boundaries.live.test.ts`). This function needs only
 * `revalidateTag`, so the category routes import it directly and stay clean.
 * `cache-revalidation.ts` re-exports it, so existing callers are unaffected.
 */
export function revalidateCategories(
  merchantId: string,
  categorySlug?: string
) {
  revalidateTag(`categories-${merchantId}`, 'categories');
  revalidateTag('navigation-categories', 'categories');
  revalidateTag(getCategoryPageDataCacheTag(merchantId), 'storefront-page');
  revalidateTag('product-canonical-redirect', 'products');
  revalidateTag('product-legacy-redirect', 'products');

  if (categorySlug) {
    revalidateTag(`category-${merchantId}-${categorySlug}`, 'categories');
  }
}
