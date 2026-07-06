import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import {
  type BlogListingStatusBody,
  getCachedStorefrontBlogListingStatus,
} from '@/lib/cached-storefront-blog-listing-status';
import { hasValidInternalAuth } from '@/lib/internal-auth-header';
import {
  internalBlogListingStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// Same cacheable-verdict mechanics as the blog-post-status preflight: the
// proxy authenticates via `x-baci-internal-auth` (an `Authorization` header
// makes a response ineligible for Vercel's CDN cache) and `Vary` keys the edge
// entry to the secret value. Only the definitive NOOP verdict ("render
// normally": no redirect, no notFound) is cached — it is self-healing (the
// route still clamps/404s a since-changed listing itself). Redirect, notFound,
// and fail-open verdicts stay no-store so a changed page count or category is
// never sticky for the TTL window. The `Vercel-Cache-Tag` is the broad
// `blog-posts` tag — the one `revalidateBlogPosts` invalidates on every blog
// mutation and that the underlying `'use cache'` resolver also carries — so
// any post/category change purges these CDN entries immediately.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: 'x-baci-internal-auth',
  'Vercel-Cache-Tag': 'blog-posts',
} as const;
// Typed against the shared contract so a shape change fails at compile time.
const FAIL_OPEN: BlogListingStatusBody = {
  hasError: true,
  redirectPath: null,
  permanent: false,
  notFound: false,
};
const INVALID_REQUEST = { error: 'Invalid input', code: 'invalid_input' };

function isCacheableNoopVerdict(result: BlogListingStatusBody): boolean {
  return (
    result.hasError === false &&
    result.redirectPath === null &&
    result.notFound === false
  );
}

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

  // Custom-header auth (preferred — keeps the verdict CDN-cacheable) with the
  // legacy `Authorization: Bearer` still accepted for mixed-deploy callers.
  if (!hasValidInternalAuth(request, expectedSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    );
  }

  const params = internalSlugSetParamsSchema.safeParse(await context.params);
  const searchParams = request.nextUrl.searchParams;
  const query = internalBlogListingStatusQuerySchema.safeParse({
    kind: searchParams.get('kind'),
    category: searchParams.get('category') ?? undefined,
    categorySlug: searchParams.get('categorySlug') ?? undefined,
    authorSlug: searchParams.get('authorSlug') ?? undefined,
    page: searchParams.get('page') ?? undefined,
  });
  if (!params.success || !query.success) {
    return NextResponse.json(INVALID_REQUEST, {
      status: 400,
      headers: NO_STORE,
    });
  }

  try {
    const result = await getCachedStorefrontBlogListingStatus(
      params.data.identifier,
      query.data
    );
    return NextResponse.json(result, {
      status: 200,
      headers: isCacheableNoopVerdict(result) ? PREFLIGHT_CACHE : NO_STORE,
    });
  } catch (error) {
    console.error('Internal blog listing status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
