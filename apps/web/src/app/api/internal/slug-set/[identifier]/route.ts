import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getMerchantSafe } from '@/lib/cached-data';
import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';
import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';
import { hasValidInternalAuth } from '@/lib/internal-auth-header';
import { logger } from '@/lib/logger';
import { getProductSlugSetCacheTag } from '@/lib/product-cache-tags';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { getProductUrl } from '@/lib/seo-utils';
import {
  internalSlugSetParamsSchema,
  internalSlugSetQuerySchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// The proxy self-fetches this membership preflight on every PDP navigation, and
// middleware runs BEFORE Vercel's CDN, so it fires on every document request that
// reaches Vercel — this cache is what keeps field TTFB low. Three mechanics make
// a cached LIVE-product verdict both cacheable AND always-fresh:
//   (a) Vercel's CDN never caches a response to a request carrying an
//       `Authorization` header (documented cacheable-response criteria), so the
//       proxy authenticates via the custom `x-baci-internal-auth` header and the
//       CDN is free to store the 200.
//   (b) `Vary: x-baci-internal-auth` keys the edge entry to the (single) internal
//       secret value, so an unauthenticated request never hits a cached 200 — it
//       misses and re-runs the timing-safe auth check.
//   (c) The `Vercel-Cache-Tag` is `product-slug-set-${merchantId}` — the SAME tag
//       the underlying `'use cache'` slug set carries and that `revalidateProducts`
//       invalidates on every product mutation — so `revalidateTag` purges this CDN
//       entry instantly. A cached present:true can never serve a stale answer
//       beyond one in-flight request.
// Only a definitive LIVE-product verdict (present:true, no redirect) is cached —
// it is self-healing (the page still renders and 404s a since-removed product). A
// definitively-absent verdict (proxy hard-404), a legacy-alias redirect verdict
// (target/slug can change), and every fail-open branch stay no-store, so a slug
// that becomes live after a cached miss is never sticky-404ed and a stale redirect
// never sticks.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: 'x-baci-internal-auth',
} as const;
// Fail-open membership: the proxy hard-404s ONLY when `present` is false AND
// `hasError` is false, so any uncertainty returns hasError:true.
const FAIL_OPEN = { hasError: true, present: false };

/**
 * Internal product-slug MEMBERSHIP endpoint for the proxy's crawl-budget
 * hard-404. The proxy can't call a `'use cache'` function directly, so it
 * fetches this route, which legally can — and returns only `{ hasError,
 * present, redirectPath? }` (NOT the whole slug list) so a large catalog
 * doesn't add slug-list transfer/parse to every PDP navigation.
 *
 * `identifier` is the storefront slug or custom domain the proxy has; `?slug=`
 * is the product slug to test. Fails open
 * (`{ hasError: true, present: false }`) on an unconfigured secret, invalid
 * input, an unresolved or UNPUBLISHED merchant, a slug-set error, or a
 * legacy-redirect resolution error — so the proxy never hard-404s a live
 * product, never pre-empts the coming-soon layout for an unpublished store, and
 * never caches a non-redirect verdict for a slug that should 308.
 *
 * Auth: `x-baci-internal-auth: ${INTERNAL_API_SECRET}` (preferred — keeps the
 * verdict CDN-cacheable) or the legacy `Authorization: Bearer ${...}` (both
 * timing-safe).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> }
): Promise<NextResponse> {
  const expectedSecret = getInternalApiSecret();
  if (!expectedSecret) {
    logger.error({ message: 'INTERNAL_API_SECRET not configured' });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: NO_STORE }
    );
  }

  if (!hasValidInternalAuth(request, expectedSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }

  const params = internalSlugSetParamsSchema.safeParse(await context.params);
  const query = internalSlugSetQuerySchema.safeParse({
    slug: request.nextUrl.searchParams.get('slug'),
  });
  if (!params.success || !query.success) {
    // Invalid input — fail open rather than 400 so the proxy never hard-404s.
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  const merchant = await getMerchantSafe(params.data.identifier);
  if (!merchant?.is_published) {
    // Unknown or unpublished storefront — fail open. An unpublished store still
    // renders its coming-soon layout; the proxy must not 404 a typo before it.
    // Marked `unknown-storefront` so the caller logs this expected verdict
    // (junk-subdomain/bot traffic) without capturing an exception. A merchant
    // LOOKUP outage can also surface here (getMerchantSafe returns null after
    // exhausting retries), but the paired product-canonical preflight on the
    // same navigation still captures that case as a plain fail-open.
    return NextResponse.json(
      { ...FAIL_OPEN, failOpenReason: 'unknown-storefront' },
      { status: 200, headers: NO_STORE }
    );
  }

  const set = await getCachedStorefrontProductSlugSet(merchant.id);
  // Fail open on an empty set as well as an errored one: an empty set cannot
  // PROVE a slug is absent (it may be a stale set cached while the catalog had
  // zero products, e.g. during the first product add/revalidation window). The
  // builder documents this — "the proxy MUST NOT 404 when the set is
  // empty/errored." Hard-404ing here would de-index a merchant's first live
  // product until the set refreshes.
  if (set.hasError || set.slugs.length === 0) {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  const target = query.data.slug.toLowerCase();
  const present = set.slugs.some((slug) => slug.toLowerCase() === target);
  if (!present) {
    // Definitively absent -> the proxy hard-404s this URL. Never cache it: a
    // product PUBLISHED after a cached miss would be hard-404ed for the whole TTL
    // window and revalidateTag cannot purge this edge entry. (A stale present:true
    // below is safe — the page still renders and 404s a since-removed product.)
    return NextResponse.json(
      { hasError: false, present: false },
      { status: 200, headers: NO_STORE }
    );
  }

  try {
    const resolution = await getCachedStorefrontProductSlugResolution(
      merchant.id,
      query.data.slug
    );
    if (resolution.hasError) {
      // Resolution failed: we cannot PROVE this present slug is a plain live
      // product rather than an archived alias that must 308. Caching the
      // {present:true} verdict below would suppress the canonical redirect for
      // the whole TTL window (revalidateTag cannot purge this header-based edge
      // entry). Fail open no-store so the next request re-resolves.
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }
    if (resolution.redirectTarget) {
      const redirectPath = toSafeInternalRedirectPath(
        getProductUrl(resolution.redirectTarget)
      );
      if (redirectPath) {
        // A legacy-alias REDIRECT verdict is kept no-store: the canonical target
        // can change or the alias slug be reused, and revalidateTag cannot purge
        // this header-based edge entry, so a cached redirect would 308 to the
        // wrong product for the whole TTL window. Only the plain live-product
        // verdict below (present:true, no redirect) is edge-cached.
        return NextResponse.json(
          { hasError: false, present: true, redirectPath },
          { status: 200, headers: NO_STORE }
        );
      }
    }
  } catch (error) {
    logger.warn({
      message: 'Failed to resolve legacy product redirect target',
      error,
      merchantId: merchant.id,
      slug: query.data.slug,
    });
    // A thrown resolution carries the same uncertainty as hasError above:
    // never cache {present:true}, which could suppress an alias 308. Fail open.
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  return NextResponse.json(
    { hasError: false, present: true },
    {
      status: 200,
      headers: {
        ...PREFLIGHT_CACHE,
        // Same tag the underlying 'use cache' slug set carries and that
        // revalidateProducts invalidates for this merchant — so any product
        // mutation purges this CDN entry immediately.
        'Vercel-Cache-Tag': getProductSlugSetCacheTag(merchant.id),
      },
    }
  );
}
