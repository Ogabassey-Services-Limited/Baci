import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
  getCachedProductCanonicalRedirectTarget,
} from '@/lib/cached-data';
import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';
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
      return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
    }

    const product = (await getCachedProductCanonicalRedirectTarget(
      merchant.id,
      query.data.slug
    )) as ProductUrlSource | null;

    if (product?.status === 'active') {
      return NextResponse.json(
        getRedirectResponseForTarget(
          query.data.category,
          query.data.slug,
          product
        ),
        { status: 200, headers: NO_STORE }
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
      return NextResponse.json(
        getRedirectResponseForTarget(
          query.data.category,
          query.data.slug,
          slugResolution.redirectTarget
        ),
        { status: 200, headers: NO_STORE }
      );
    }

    if (slugResolution.present) {
      return NextResponse.json(
        { hasError: false, matchedProduct: true, redirectPath: null },
        { status: 200, headers: NO_STORE }
      );
    }

    return NextResponse.json(NO_REDIRECT, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
