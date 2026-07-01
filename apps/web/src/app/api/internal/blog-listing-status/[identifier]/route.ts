import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getCachedStorefrontBlogListingStatus } from '@/lib/cached-storefront-blog-listing-status';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  internalBlogListingStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const FAIL_OPEN = {
  hasError: true,
  redirectPath: null,
  permanent: false,
  notFound: false,
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
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error('Internal blog listing status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
