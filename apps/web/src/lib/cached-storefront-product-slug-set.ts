import { cacheLife, cacheTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';

export interface StorefrontProductSlugSetResult {
  hasError: boolean;
  /**
   * Every product slug for the merchant, regardless of status. This is a
   * membership set, NOT a content fetch: the proxy uses it to hard-404 only
   * slugs that match NO product row (true typos). Active and archived slugs are
   * both included so the proxy never 404s a slug the page would legacy-308 — it
   * falls through to the existing page-level resolution instead.
   */
  slugs: string[];
}

/**
 * Cached membership set of all product slugs for a merchant, used by the proxy
 * (via an internal route handler — `'use cache'` cannot run in the proxy
 * context) to decide whether an unknown PDP slug should be a hard 404.
 *
 * Tagged with a DEDICATED `product-slug-set-${merchantId}` tag so it is
 * invalidated on every product mutation (see `revalidateProducts`). Fail-open:
 * on any error it returns `{ hasError: true, slugs: [] }` and callers MUST NOT
 * 404 when the set is empty/errored — a stale-set miss must never de-index a
 * live product.
 */
export async function getCachedStorefrontProductSlugSet(
  merchantId: string
): Promise<StorefrontProductSlugSetResult> {
  'use cache: remote';
  cacheLife('products');
  cacheTag('products', `product-slug-set-${merchantId}`);

  const supabase = createPublicClient({
    clientInfo: 'baci-storefront-product-slug-set',
  });

  const { data, error } = await supabase
    .from('products')
    .select('slug')
    .eq('merchant_id', merchantId)
    .not('slug', 'is', null);

  if (error) {
    console.error('Error fetching storefront product slug set:', error);
    return { hasError: true, slugs: [] };
  }

  const slugs = (data ?? [])
    .map((row) => row.slug?.trim())
    .filter((slug): slug is string => Boolean(slug));

  return { hasError: false, slugs };
}
