import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getCachedStorefrontBlogPostStatus } from '@/lib/cached-storefront-blog-post-status';
import {
  getValidatedInternalAuthMethod,
  INTERNAL_AUTH_HEADER,
} from '@/lib/internal-auth-header';
import {
  internalBlogPostStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// The proxy self-fetches this preflight on every storefront blog-post
// navigation, and middleware runs BEFORE Vercel's CDN, so it fires on every
// document request that reaches Vercel — this cache is what keeps field TTFB
// low. Three mechanics make a cached LIVE-post verdict both cacheable AND
// always-fresh:
//   (a) Vercel's CDN never caches a response to a request carrying an
//       `Authorization` header (documented cacheable-response criteria), so the
//       proxy authenticates via the custom `x-baci-internal-auth` header and the
//       CDN is free to store the 200.
//   (b) `Vary: x-baci-internal-auth` keys the edge entry to the (single) internal
//       secret value, so an unauthenticated request never hits a cached 200 — it
//       misses and re-runs the timing-safe auth check.
//   (c) The `Vercel-Cache-Tag` is `getBlogCacheTag(identifier, slug)` — the SAME
//       tag the underlying `'use cache'` fn carries and that `revalidateBlogPosts`
//       invalidates on every post mutation — so `revalidateTag` purges this CDN
//       entry instantly. A cached present:true can never serve a stale answer
//       beyond one in-flight request.
// Only a definitive LIVE-post verdict (present:true, no redirect) is cached — it
// is self-healing (the page still renders and 404s a since-removed post). A
// definitive-absent verdict (proxy hard-404), a fail-open/error, and a
// retired-slug REDIRECT verdict all stay no-store: absent/redirect verdicts must
// never be sticky (a since-published post or a changed/reused redirect target
// would otherwise be wrong for the whole TTL window).
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: INTERNAL_AUTH_HEADER,
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

  const authMethod = getValidatedInternalAuthMethod(request, expectedSecret);
  if (!authMethod) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }
  // Only custom-header requests may receive cacheable headers: RFC 9111 §3.5
  // lets a shared cache store an Authorization-request response when s-maxage
  // is present, and such an entry would be keyed with the custom header ABSENT
  // — the same Vary key an unauthenticated request would hit.
  const allowEdgeCache = authMethod === 'custom-header';

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
    // Cache ONLY a definitive, LIVE-post verdict (present:true with no
    // redirect). A definitive-absent (present:false -> proxy hard-404) or a
    // fail-open (hasError:true) answer must never be sticky — the resolver can
    // return hasError:true WITHOUT throwing (e.g. a transient merchant-lookup
    // failure, or an unpublished store). A retired-slug REDIRECT verdict
    // (present:true + redirectPath) is also kept no-store: the redirect target
    // can change or the slug be reused, and revalidateTag cannot purge this
    // header-based edge entry, so a cached redirect would go stale for the whole
    // TTL window (mirrors the slug-set route).
    const cacheable =
      allowEdgeCache &&
      result.hasError === false &&
      result.present === true &&
      result.redirectPath == null;
    return NextResponse.json(result, {
      status: 200,
      headers: cacheable
        ? {
            ...PREFLIGHT_CACHE,
            // Same tag the underlying 'use cache' fn carries and that
            // revalidateBlogPosts invalidates for this post — so any mutation
            // purges this CDN entry immediately (never comma-bearing, always
            // < 256 chars).
            'Vercel-Cache-Tag': getBlogCacheTag(
              params.data.identifier,
              query.data.slug
            ),
          }
        : NO_STORE,
    });
  } catch (error) {
    console.error('Internal blog post status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
