import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { buildInternalProductPurgeEntries } from '@/lib/internal-product-purge-entries';
import { logger } from '@/lib/logger';
import { scheduleStorefrontProductPurge } from '@/lib/storefront-product-purge';
import { countDistinctProductPurgeEntries } from '@/lib/storefront-purge-urls';
import { internalRevalidateProductsBodySchema } from '@/schemas/internal-revalidate-products-route';

// Past this many products in one request, purge only the shared listing
// surfaces (home, /products, distinct /<category>) to bound the outbound
// fan-out against Cloudflare's per-request URL budget; the short-TTL PDPs
// self-heal. Mirrors the bulk-update route threshold.
const PURGE_LISTINGS_ONLY_THRESHOLD = 50;

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

  // Runs in a route context, so revalidateTag works here (unlike the CLI worker).
  revalidateProducts(parsed.data.merchantId);

  // When the caller supplies the merchant slug AND product entries, also evict
  // the affected products' public URLs from Cloudflare (the standalone import
  // worker and the mobile-admin save path have no Next store context, so this
  // Bearer-authed route is where the purge reliably runs). Fire-and-forget: a
  // purge is always survivable, so it must never fail the revalidation.
  const { merchantSlug, products } = parsed.data;
  if (merchantSlug && products && products.length > 0) {
    try {
      const purgeEntries = buildInternalProductPurgeEntries(products);
      // Base the fan-out threshold on the DISTINCT (slug, segment) count so
      // duplicate entries for one product do not inflate the count and wrongly
      // suppress its per-PDP purge.
      const distinctPurgeCount = countDistinctProductPurgeEntries(purgeEntries);
      scheduleStorefrontProductPurge(merchantSlug, purgeEntries, {
        listingsOnly: distinctPurgeCount > PURGE_LISTINGS_ONLY_THRESHOLD,
      });
    } catch (purgeError) {
      logger.error({
        message: 'Skipped Cloudflare product purge in revalidate-products',
        error: purgeError,
      });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
