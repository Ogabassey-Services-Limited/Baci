import { type NextRequest, NextResponse } from 'next/server';
import { resolveCategoryCompareHubStatus } from '@/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/resolve-category-compare-hub-status';
import { getInternalApiSecret } from '@/env';
import {
  getValidatedInternalAuthMethod,
  INTERNAL_AUTH_HEADER,
} from '@/lib/internal-auth-header';
import {
  type InternalCompareHubStatusBody,
  internalCompareHubStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// Only the safe RENDERABLE verdict is edge-cacheable (custom-header auth only,
// same RFC 9111 §3.5 reasoning as the blog-status preflights): a stale
// "renderable" self-heals because the hub page still runs its own thin-hub 404
// guard. The EMPTY verdict stays no-store so a category that gains eligible
// products serves 200 on the very next crawl — an edge-cached "empty" would
// keep hard-404ing a live hub for the TTL window. No Vercel-Cache-Tag: the
// underlying inventory reads are deliberately uncached, so a short TTL is the
// only staleness bound this entry needs.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: INTERNAL_AUTH_HEADER,
} as const;
// Typed against the shared contract so a shape change fails at compile time.
const FAIL_OPEN: InternalCompareHubStatusBody = {
  empty: false,
  hasError: true,
};
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
  const allowEdgeCache = authMethod === 'custom-header';

  const params = internalSlugSetParamsSchema.safeParse(await context.params);
  const query = internalCompareHubStatusQuerySchema.safeParse({
    category: request.nextUrl.searchParams.get('category') ?? undefined,
  });
  if (!params.success || !query.success) {
    return NextResponse.json(INVALID_REQUEST, {
      status: 400,
      headers: NO_STORE,
    });
  }

  try {
    const status = await resolveCategoryCompareHubStatus({
      merchantSlug: params.data.identifier,
      categorySlug: query.data.category,
    });
    const body: InternalCompareHubStatusBody = {
      empty: status.kind === 'empty',
      hasError: false,
    };
    return NextResponse.json(body, {
      status: 200,
      headers: allowEdgeCache && !body.empty ? PREFLIGHT_CACHE : NO_STORE,
    });
  } catch (error) {
    console.error('Internal compare hub status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
