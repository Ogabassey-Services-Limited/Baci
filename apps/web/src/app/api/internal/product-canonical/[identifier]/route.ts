import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProductCanonicalRedirectTarget,
} from '@/lib/cached-data';
import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';
import { hasValidInternalAuth } from '@/lib/internal-auth-header';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';
import { getProductSlugSetCacheTag } from '@/lib/product-cache-tags';
import { getProductUrl } from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';
import {
  internalProductCanonicalRedirectQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const FAIL_OPEN = { hasError: true, matchedProduct: false, redirectPath: null };
const NO_REDIRECT = {
  hasError: false,
  matchedProduct: false,
  redirectPath: null,
};
// Same cacheable-verdict mechanics as the slug-set/blog-post-status preflights:
// the proxy authenticates via `x-baci-internal-auth` (an `Authorization` header
// makes a response ineligible for Vercel's CDN cache), `Vary` keys the edge
// entry to the secret value, and the `Vercel-Cache-Tag` is the SAME
// `product-slug-set-${merchantId}` tag that `revalidateProducts` invalidates on
// every product mutation. Only the definitive live no-redirect verdict
// (`matchedProduct: true`, no redirectPath) is cached — it is self-healing (the
// page itself still canonicalizes or 404s a since-changed product). Redirect
// verdicts, absent verdicts, and every fail-open branch stay no-store so a
// changed canonical target or a since-published product is never sticky for
// the TTL window.
const PREFLIGHT_CACHE = {
  'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
  Vary: 'x-baci-internal-auth',
} as const;

interface CanonicalVerdictBody {
  hasError: boolean;
  matchedProduct: boolean;
  redirectPath: string | null;
  /** Present when the fail-open is expected (no published storefront), not an incident. */
  failOpenReason?: 'unknown-storefront';
}

function toVerdictResponse(
  body: CanonicalVerdictBody,
  cacheTagMerchantId: string
): NextResponse {
  const cacheable =
    body.hasError === false &&
    body.matchedProduct === true &&
    body.redirectPath === null;

  return NextResponse.json(body, {
    status: 200,
    headers: cacheable
      ? {
          ...PREFLIGHT_CACHE,
          'Vercel-Cache-Tag': getProductSlugSetCacheTag(cacheTagMerchantId),
        }
      : NO_STORE,
  });
}

interface ProductUrlSource {
  canonical_url?: string | null;
  category?: string | null;
  categories?:
    | { name?: string | null; slug?: string | null }
    | { name?: string | null; slug?: string | null }[]
    | null;
  condition?: string | null;
  condition_detail?: string | null;
  id: string;
  name: string;
  slug?: string | null;
  status?: string | null;
}

function normalizePublicPdpPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    return pathname.replace(/\/+$/g, '') || '/';
  }

  const [category, slug] = segments;
  const normalizedCategory =
    normalizeStorefrontCategorySlug(category) ?? category;
  return `/${normalizedCategory}/${slug}`;
}

function normalizePath(path: string) {
  return normalizePublicPdpPath(path).toLowerCase();
}

function asProductUrlSource(value: ProductUrlSource) {
  const category = Array.isArray(value.categories)
    ? (value.categories[0] ?? null)
    : (value.categories ?? null);

  return {
    canonical_url: value.canonical_url,
    category: value.category,
    categories: category?.slug
      ? {
          name: category.name ?? undefined,
          slug: category.slug,
        }
      : null,
    condition: value.condition ?? undefined,
    condition_detail: value.condition_detail ?? undefined,
    id: value.id,
    name: value.name,
    slug: value.slug ?? undefined,
  };
}

async function getPublishedMerchant(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const merchant = isDomainIdentifier(normalizedIdentifier)
    ? await getCachedMerchantByDomain(normalizedIdentifier)
    : await getCachedMerchant(normalizedIdentifier);

  return merchant?.is_published ? merchant : null;
}

function getRedirectResponseForTarget(
  requestedCategory: string,
  requestedSlug: string,
  target: ProductUrlSource
) {
  const targetPath = normalizePublicPdpPath(
    getProductUrl({
      ...asProductUrlSource(target),
      canonical_url: null,
    })
  );
  const requestedPath = `/${requestedCategory}/${requestedSlug}`;

  if (normalizePath(targetPath) === normalizePath(requestedPath)) {
    return { hasError: false, matchedProduct: true, redirectPath: null };
  }

  return { hasError: false, matchedProduct: true, redirectPath: targetPath };
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
  const query = internalProductCanonicalRedirectQuerySchema.safeParse({
    category: request.nextUrl.searchParams.get('category'),
    slug: request.nextUrl.searchParams.get('slug'),
  });
  if (!params.success || !query.success) {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }

  try {
    const merchant = await getPublishedMerchant(params.data.identifier);
    if (!merchant) {
      // Definitive absence: the cached merchant lookups THROW on transient
      // errors (caught below as a plain fail-open), so a null here means no
      // published storefront exists for this identifier — expected junk
      // subdomain/bot traffic the proxy should log without capturing an
      // exception.
      return NextResponse.json(
        { ...FAIL_OPEN, failOpenReason: 'unknown-storefront' },
        { status: 200, headers: NO_STORE }
      );
    }

    const product = (await getCachedProductCanonicalRedirectTarget(
      merchant.id,
      query.data.slug
    )) as ProductUrlSource | null;

    if (product?.status === 'active') {
      return toVerdictResponse(
        getRedirectResponseForTarget(
          query.data.category,
          query.data.slug,
          product
        ),
        merchant.id
      );
    }

    const slugResolution = await getCachedStorefrontProductSlugResolution(
      merchant.id,
      query.data.slug
    );

    if (slugResolution.hasError) {
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }

    if (slugResolution.redirectTarget) {
      return toVerdictResponse(
        getRedirectResponseForTarget(
          query.data.category,
          query.data.slug,
          slugResolution.redirectTarget
        ),
        merchant.id
      );
    }

    if (slugResolution.present) {
      return toVerdictResponse(
        { hasError: false, matchedProduct: true, redirectPath: null },
        merchant.id
      );
    }

    return NextResponse.json(NO_REDIRECT, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
