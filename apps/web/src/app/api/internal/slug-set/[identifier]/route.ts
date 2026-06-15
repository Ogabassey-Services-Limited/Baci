import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInternalApiSecret } from '@/env';
import { getMerchantSafe } from '@/lib/cached-data';
import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// Fail-open membership: the proxy hard-404s ONLY when `present` is false AND
// `hasError` is false, so any uncertainty returns hasError:true.
const FAIL_OPEN = { hasError: true, present: false };

const paramsSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
});
const querySchema = z.object({ slug: z.string().trim().min(1).max(255) });

/**
 * Internal product-slug MEMBERSHIP endpoint for the proxy's crawl-budget
 * hard-404. The proxy can't call a `'use cache'` function directly, so it
 * fetches this route, which legally can — and returns only `{ hasError,
 * present }` (NOT the whole slug list) so a large catalog doesn't add slug-list
 * transfer/parse to every PDP navigation.
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

  const params = paramsSchema.safeParse(await context.params);
  const query = querySchema.safeParse({
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

  return NextResponse.json(
    { hasError: false, present },
    { status: 200, headers: NO_STORE }
  );
}
