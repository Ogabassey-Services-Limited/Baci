import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { revalidateBlogPosts } from '@/lib/cache-revalidation';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';
import { internalRevalidateBlogBodySchema } from '@/schemas/internal-revalidate-blog-route';

/**
 * Internal blog-cache revalidation endpoint.
 *
 * VPS content jobs publish, enrich, archive, and redirect blog rows outside a
 * Next request context. Direct DB writes cannot call `revalidatePath` or
 * `revalidateTag`, so previously prerendered blog pages can continue serving
 * stale HTML. This Bearer-authed route runs in the app context and evicts the
 * exact storefront blog paths/tags after those jobs finish.
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

  const parsed = internalRevalidateBlogBodySchema.safeParse(json);
  if (!parsed.success) {
    logger.warn({
      message: 'Invalid internal blog revalidation payload',
      details: parsed.error.flatten(),
    });
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  revalidateBlogPosts({
    merchantId: parsed.data.merchantId,
    identifiers: parsed.data.identifiers,
    canonicalMerchantSlug: parsed.data.canonicalMerchantSlug,
    listingCategories: parsed.data.listingCategories ?? [],
    listingPages: parsed.data.listingPages ?? [1],
    postSlugs: parsed.data.postSlugs,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
