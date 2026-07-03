import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getCachedStorefrontBlogPostStatus } from '@/lib/cached-storefront-blog-post-status';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  internalBlogPostStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// The proxy self-fetches this internal preflight on every storefront blog-post
// navigation. The underlying data is already memoized (cacheLife('blog')), so a
// short edge TTL lets Vercel's CDN absorb repeat preflights instead of hitting
// the origin each time. Only a PRESENT verdict (found post, or a retired->redirect)
// is cached — it is self-healing because the page still renders and 404s a
// since-removed post. A definitive-absent verdict makes the proxy hard-404 the
// post, and a fail-open/error is a transient miss; neither may be sticky
// (revalidateTag cannot purge this header-based edge entry), so both stay
// no-store.
// `Vary: Authorization` is REQUIRED: RFC 9111 §3.5 lets a shared cache store and
// replay an `s-maxage` response to requests that carried an `Authorization`
// header, so without this a cached 200 could be served to a caller WITHOUT
// re-running the bearer-token check. Varying on Authorization keys the edge
// entry to the (single) internal secret and blocks unauthenticated cache hits.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: 'Authorization',
} as const;
const FAIL_OPEN = { hasError: true, present: false, redirectPath: null };
const INVALID_REQUEST = { error: 'Invalid input', code: 'invalid_input' };

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ identifier: string }> }
): Promise<NextResponse> {
  const expectedSecret = getInternalApiSecret();
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: NO_STORE }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (
    !authHeader ||
    !constantTimeEqual(authHeader, `Bearer ${expectedSecret}`)
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }

  const params = internalSlugSetParamsSchema.safeParse(await context.params);
  const query = internalBlogPostStatusQuerySchema.safeParse({
    slug: request.nextUrl.searchParams.get('slug'),
  });
  if (!params.success || !query.success) {
    return NextResponse.json(INVALID_REQUEST, {
      status: 400,
      headers: NO_STORE,
    });
  }

  try {
    const result = await getCachedStorefrontBlogPostStatus(
      params.data.identifier,
      query.data.slug
    );
    // Cache ONLY a definitive PRESENT verdict. A definitive-absent (present:false
    // -> proxy hard-404) or a fail-open (hasError:true) answer must never be
    // sticky — the resolver can return hasError:true WITHOUT throwing (e.g. a
    // transient merchant-lookup failure, or an unpublished store) — so those stay
    // no-store (mirrors the slug-set route).
    const cacheable = result.hasError === false && result.present === true;
    return NextResponse.json(result, {
      status: 200,
      headers: cacheable ? PREFLIGHT_CACHE : NO_STORE,
    });
  } catch (error) {
    console.error('Internal blog post status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
