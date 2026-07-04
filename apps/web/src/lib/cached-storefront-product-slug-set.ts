import { cacheLife, cacheTag } from 'next/cache';
import { getProductSlugSetCacheTag } from '@/lib/product-cache-tags';
import { createPublicClient } from '@/lib/supabase/public';

export interface StorefrontProductSlugSetResult {
  hasError: boolean;
  /**
   * The merchant's publicly-resolvable product slugs. This is a membership set,
   * NOT a content fetch: the proxy uses it to hard-404 only slugs that match NO
   * resolvable product (true typos). Includes active slugs (render the PDP) and
   * archived slugs ONLY when they legacy-308 to an active parent — so the proxy
   * never 404s a redirectable URL. Draft/unpublished AND non-redirectable
   * archived slugs are excluded so their URLs correctly hard-404.
   */
  slugs: string[];
}

/**
 * Cached membership set of a merchant's resolvable product slugs, used by the
 * proxy (via an internal route handler — `'use cache'` cannot run in the proxy
 * context) to decide whether an unknown PDP slug should be a hard 404.
 *
 * Uses the anon `createPublicClient` (NOT a service-role client — that is
 * forbidden in user-request-path helpers) plus the `get_merchant_product_slug_set`
 * SECURITY DEFINER RPC. The RPC returns the passed merchant's resolvable slugs
 * only (active, plus archived that legacy-308 to an active parent — and nothing
 * else), so it can include redirectable archived slugs (which anon RLS would
 * otherwise hide) without the broad privileges of a service-role client. It
 * returns a single `text[]`, so there is no PostgREST 1000-row cap to paginate.
 *
 * Tagged with a DEDICATED `product-slug-set-${merchantId}` tag so it is
 * invalidated on every product mutation via `revalidateProductsReliable` — which
 * works in a Next context (dashboard, API routes, import cron route) AND from the
 * standalone CLI import worker (via the internal Bearer revalidation endpoint,
 * since the worker has no store context for `revalidateTag`). The `cacheLife`
 * TTL is just the backstop if that invalidation ever fails.
 *
 * Fail-open: on any error it returns `{ hasError: true, slugs: [] }` and the
 * proxy MUST NOT 404 when the set is empty/errored — a stale or partial set must
 * never de-index a live product.
 */
export async function getCachedStorefrontProductSlugSet(
  merchantId: string
): Promise<StorefrontProductSlugSetResult> {
  'use cache: remote';
  cacheLife('products');
  cacheTag('products', getProductSlugSetCacheTag(merchantId));

  const supabase = createPublicClient({
    clientInfo: 'storefront-product-slug-set',
  });

  const { data, error } = await supabase.rpc('get_merchant_product_slug_set', {
    p_merchant_id: merchantId,
  });

  if (error) {
    console.error('Error fetching storefront product slug set:', error);
    return { hasError: true, slugs: [] };
  }

  const slugs = ((data as string[] | null) ?? [])
    .map((slug) => (typeof slug === 'string' ? slug.trim() : ''))
    .filter((slug): slug is string => slug.length > 0);

  return { hasError: false, slugs };
}
