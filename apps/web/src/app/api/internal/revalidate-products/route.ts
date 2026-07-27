import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { enrichProductPurgeEntries } from '@/lib/authoritative-product-purge-enrichment';
import {
  revalidateProductSlugs,
  revalidateProducts,
} from '@/lib/cache-revalidation';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import {
  scheduleStorefrontHostnamePurge,
  scheduleStorefrontProductPurge,
} from '@/lib/storefront-product-purge';
import { createPublicClient } from '@/lib/supabase/public';
import { internalRevalidateProductsBodySchema } from '@/schemas/internal-revalidate-products-route';

/**
 * Internal product-cache revalidation endpoint.
 *
 * `revalidateTag` requires a Next request/store context, which the standalone
 * import worker (`scripts/process-import-jobs.ts`) does NOT have — so its
 * in-process `revalidateProducts` is a no-op. That worker calls this Bearer-authed
 * route instead, which DOES run in a route context, to reliably invalidate the
 * product caches (incl. the proxy crawl-budget `product-slug-set-${merchantId}`)
 * after an import — so freshly imported products are never hard-404ed waiting on
 * the cacheLife TTL. See `revalidateProductsReliable`.
 *
 * Auth: `Authorization: Bearer ${INTERNAL_API_SECRET}` (timing-safe). Bearer
 * requests are CSRF-exempt and rate-limit-exempt in the proxy.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const expectedSecret = getInternalApiSecret();
  if (!expectedSecret) {
    logger.error({ message: 'INTERNAL_API_SECRET not configured' });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (
    !authHeader ||
    !constantTimeEqual(authHeader, `Bearer ${expectedSecret}`)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = internalRevalidateProductsBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { merchantId, merchantSlug, products, purgeWholeStorefront } =
    parsed.data;

  // Runs in a route context, so revalidateTag works here (unlike the CLI worker).
  revalidateProducts(merchantId);

  // When the caller supplies product entries, resolve them against the DB and
  // bust their per-slug Next caches; when it ALSO supplies the merchant slug,
  // evict the products' public URLs from Cloudflare (the standalone import
  // worker and the mobile-admin save path have no Next store context, so this
  // Bearer-authed route is where the purge reliably runs). The per-slug bust
  // needs only merchantId, so it is deliberately NOT gated on merchantSlug — a
  // failed slug lookup upstream must not leave stale PDP entries in the Next
  // cache. Fire-and-forget: a purge is always survivable, so it must never
  // fail the revalidation.
  if (products && products.length > 0) {
    try {
      // Enrich from the product ROWS with the SAME resolution `/api/cache/revalidate`
      // performs, so an {id}-only import/save entry purges the real slug/category
      // URLs (not `/products/<uuid>`). Service-role client: this route is
      // Anon public client per repo rule (no service-role for lookups): the
      // anon policy exposes only ACTIVE rows, which is sufficient — draft/
      // pending PDPs are never publicly cached, so an unresolved row simply
      // falls back to the caller's hints + the always-purged fallback URLs.
      // Fail-open lives inside the enrichment.
      const supabase = createPublicClient({
        clientInfo: 'internal-revalidate-products-purge',
      });
      const { entries, resolvedSlugs } = await enrichProductPurgeEntries(
        supabase,
        merchantId,
        products
      );
      // Bust the per-slug Next product-detail caches for every resolved slug
      // BEFORE scheduling the edge purge: the PDP snapshot is tagged per-slug
      // and is NOT invalidated by the slug-less revalidateProducts above, so a
      // Cloudflare MISS would otherwise refill from stale Next data until TTL.
      revalidateProductSlugs(merchantId, resolvedSlugs);
      if (merchantSlug && !purgeWholeStorefront) {
        scheduleStorefrontProductPurge(merchantSlug, entries);
      }
    } catch (purgeError) {
      logger.error({
        message: 'Skipped Cloudflare product purge in revalidate-products',
        error: purgeError,
      });
    }
  }

  // Category path changes are structural: the affected public documents cannot
  // be enumerated safely from a category mutation, so use the bounded hostname
  // purge rather than a partial URL list. The schema requires merchantSlug for
  // this flag, but keep the guard as defence in depth for future callers.
  if (purgeWholeStorefront && merchantSlug) {
    scheduleStorefrontHostnamePurge(merchantSlug);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
