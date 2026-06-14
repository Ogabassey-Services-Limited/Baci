import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const FAIL_OPEN = { hasError: true, slugs: [] as string[] };

/**
 * Internal slug-set endpoint for the proxy's crawl-budget existence check.
 *
 * The proxy cannot call a `'use cache'` function directly (its bundle never
 * initializes Next's manifests singleton, so the first cache miss throws at
 * runtime). A route handler CAN, so the proxy fetches this endpoint.
 *
 * `identifier` is the storefront slug OR custom domain the proxy already has
 * (`domainMerchantSlug ?? domain`) — the proxy has no merchant UUID. This route
 * resolves it to a merchant (via the cached resolver) and returns that
 * merchant's product slug-set as JSON.
 *
 * Always 200 (no-store): on a missing secret config it is 500; on a missing
 * merchant or builder error it returns `{ hasError: true, slugs: [] }` so the
 * proxy's fetch never sees a transport error and fails open itself (a stale set
 * must never hard-404 a live product).
 *
 * Auth: `Authorization: Bearer ${INTERNAL_API_SECRET}` (timing-safe), so this is
 * not a public slug-scraping endpoint.
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

  const { identifier } = await context.params;

  const merchant = await getMerchantByIdentifier(identifier);
  if (!merchant) {
    // Unknown/unresolvable storefront — fail open so the proxy does not 404 a
    // product based on a merchant-resolution miss.
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  const result = await getCachedStorefrontProductSlugSet(merchant.id);
  return NextResponse.json(result, { status: 200, headers: NO_STORE });
}
