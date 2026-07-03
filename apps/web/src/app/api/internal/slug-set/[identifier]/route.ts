import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getMerchantSafe } from '@/lib/cached-data';
import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';
import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';
import { getProductUrl } from '@/lib/seo-utils';
import {
  internalSlugSetParamsSchema,
  internalSlugSetQuerySchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// The proxy self-fetches this membership preflight on every PDP navigation. The
// underlying slug set is already memoized (`use cache`), so a short edge TTL lets
// Vercel's CDN absorb repeat preflights instead of hitting the origin each time.
// Only a PRESENT verdict (present:true) is cached — it is self-healing because the
// page still renders and 404s a since-removed product. A definitively-absent
// verdict (which the proxy turns into a hard-404) and every fail-open branch stay
// no-store, so a slug that becomes live after a cached miss is never sticky-404ed
// (revalidateTag cannot purge this header-based edge entry).
// `Vary: Authorization` is REQUIRED: RFC 9111 §3.5 lets a shared cache store and
// replay an `s-maxage` response to requests that carried an `Authorization`
// header, so without this a cached 200 could be served to a caller WITHOUT
// re-running the bearer-token check. Varying on Authorization keys the edge
// entry to the (single) internal secret and blocks unauthenticated cache hits.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: 'Authorization',
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
 * is the product slug to test. Always 200 (no-store). Fails open
 * (`{ hasError: true, present: false }`) on an unconfigured secret, invalid
 * input, an unresolved or UNPUBLISHED merchant, or a slug-set error — so the
 * proxy never hard-404s a live product (and never pre-empts the coming-soon
 * layout for an unpublished store).
 *
 * Auth: `Authorization: Bearer ${INTERNAL_API_SECRET}` (timing-safe).
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
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
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
    if (!resolution.hasError && resolution.redirectTarget) {
      const redirectPath = toSafeInternalRedirectPath(
        getProductUrl(resolution.redirectTarget)
      );
      if (redirectPath) {
        return NextResponse.json(
          { hasError: false, present: true, redirectPath },
          { status: 200, headers: PREFLIGHT_CACHE }
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
  }

  return NextResponse.json(
    { hasError: false, present: true },
    { status: 200, headers: PREFLIGHT_CACHE }
  );
}
