import { cacheLife, cacheTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

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

// PostgREST caps a single un-ranged select (default 1000 rows). The hard-404
// decision treats the set as exhaustive, so we MUST page through every row —
// a truncated set would 404 live products beyond the first page.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // 50k slugs — a safety bound well above any real catalog.

/**
 * Cached membership set of all product slugs for a merchant, used by the proxy
 * (via an internal route handler — `'use cache'` cannot run in the proxy
 * context) to decide whether an unknown PDP slug should be a hard 404.
 *
 * Uses the service-role client (`createAdminClient`) ON PURPOSE: anon RLS only
 * exposes ACTIVE products, but the set must include ARCHIVED slugs so the proxy
 * does not hard-404 a URL the page would legacy-308. This is an internal,
 * cached membership read (Bearer-gated route, never returned to a browser) — the
 * same cached-service-role pattern `getCachedMerchant*` use.
 *
 * Tagged with a DEDICATED `product-slug-set-${merchantId}` tag so it is
 * invalidated on every product mutation via `revalidateProductsReliable` — which
 * works in a Next context (dashboard, API routes, import cron route) AND from the
 * standalone CLI import worker (via the internal Bearer revalidation endpoint,
 * since the worker has no store context for `revalidateTag`). The `cacheLife`
 * TTL is just the backstop if that invalidation ever fails.
 *
 * Fail-open: on any error (including a possibly-truncated page) it returns
 * `{ hasError: true, slugs: [] }` and the proxy MUST NOT 404 when the set is
 * empty/errored — a stale or partial set must never de-index a live product.
 */
export async function getCachedStorefrontProductSlugSet(
  merchantId: string
): Promise<StorefrontProductSlugSetResult> {
  'use cache: remote';
  cacheLife('products');
  cacheTag('products', `product-slug-set-${merchantId}`);

  const supabase = createAdminClient();
  const slugs: string[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from('products')
      .select('slug')
      .eq('merchant_id', merchantId)
      .not('slug', 'is', null)
      // Deterministic order is REQUIRED for correct pagination — without an
      // ORDER BY, Postgres does not guarantee row order across .range() pages,
      // so pages could overlap/skip and a skipped live slug would be hard-404ed.
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching storefront product slug set:', error);
      return { hasError: true, slugs: [] };
    }

    const batch = data ?? [];
    for (const row of batch) {
      const slug = row.slug?.trim();
      if (slug) {
        slugs.push(slug);
      }
    }

    if (batch.length < PAGE_SIZE) {
      return { hasError: false, slugs };
    }
  }

  // Hit the page bound without exhausting rows — the set may be truncated, so
  // fail open rather than risk hard-404ing live products beyond the bound.
  console.error(
    'Storefront product slug set exceeded the page bound; failing open',
    { merchantId }
  );
  return { hasError: true, slugs: [] };
}
