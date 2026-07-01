import { type NextRequest, NextResponse } from 'next/server';
import { getInternalApiSecret } from '@/env';
import { getCachedStorefrontBlogPostStatus } from '@/lib/cached-storefront-blog-post-status';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  internalBlogPostStatusQuerySchema,
  internalSlugSetParamsSchema,
} from '@/schemas/internal-slug-set-route';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
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
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error('Internal blog post status resolution failed', { error });
    return NextResponse.json(FAIL_OPEN, { status: 200, headers: NO_STORE });
  }
}
