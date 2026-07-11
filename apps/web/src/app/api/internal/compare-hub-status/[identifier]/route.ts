import { type NextRequest, NextResponse } from 'next/server';
import { resolveCategoryCompareHubStatus } from '@/app/(storefront)/[slug]/(catalog)/(listing)/[category]/compare/resolve-category-compare-hub-status';
import { getInternalApiSecret } from '@/env';
import {
  getValidatedInternalAuthMethod,
  INTERNAL_AUTH_HEADER,
} from '@/lib/internal-auth-header';
import { getProductSlugSetCacheTag } from '@/lib/product-cache-tags';
import {
  type InternalCompareHubStatusBody,
  internalCompareHubStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
// Only a CONFIRMED-renderable verdict (published store, healthy load, >=1 link)
// is edge-cacheable (custom-header auth only, same RFC 9111 §3.5 reasoning as
// the blog-status preflights). The EMPTY verdict is always no-store so a
// category that gains products serves 200 on the very next crawl, and the
// fail-open UNKNOWN verdict (draft store, degraded categories/inventory) is
// never cached so a resolved ambiguity emits the hard 404 immediately.
//
// The cached entry carries a Vercel-Cache-Tag keyed to the merchant's product
// slug set and categories, so the SAME mutations that flip a hub between
// renderable and empty (revalidateProducts / revalidateMerchantCategories)
// purge this CDN entry — a renderable hub whose last eligible product is
// deleted stops returning a stale `empty:false` within the mutation, not after
// the TTL.
function buildRenderableCacheHeaders(merchantId: string) {
  return {
    'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
    Vary: INTERNAL_AUTH_HEADER,
    'Vercel-Cache-Tag': `${getProductSlugSetCacheTag(merchantId)},categories-${merchantId}`,
  } as const;
}
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

    // Confirmed renderable → cacheable (tagged for product/category purge).
    if (status.kind === 'renderable') {
      const body: InternalCompareHubStatusBody = {
        empty: false,
        hasError: false,
      };
      return NextResponse.json(body, {
        status: 200,
        headers: allowEdgeCache
          ? buildRenderableCacheHeaders(status.merchantId)
          : NO_STORE,
      });
    }

    // Confirmed empty → hard-404 verdict; fail-open UNKNOWN → hasError. Both
    // stay no-store so a resolved transition is never masked by a stale cache.
    const body: InternalCompareHubStatusBody = {
      empty: status.kind === 'empty',
      hasError: status.kind === 'unknown',
    };
    return NextResponse.json(body, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error('Internal compare hub status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
