import { type NextRequest, NextResponse } from 'next/server';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { googleMerchantFeedQuerySchema } from '@/schemas/google-merchant-feed-query';
import { generateFacebookCatalogFeedForIdentifier } from './feed-service';

/**
 * Facebook & Instagram Product Catalog Feed API.
 *
 * Generates a Meta-compatible XML feed from the same merchant resolver,
 * product query, canonical URLs, and verified image manifest used by the
 * Google Merchant Center feed.
 *
 * Usage: /api/feed/facebook?merchant_id=xxx
 * or: /api/feed/facebook?merchant_slug=xxx
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    merchant_id: searchParams.get('merchant_id') || undefined,
    merchant_slug: searchParams.get('merchant_slug') || undefined,
  };

  const parsed = googleMerchantFeedQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid query parameters' },
      { status: 400 }
    );
  }

  const { merchant_id: merchantIdParam, merchant_slug: merchantSlug } =
    parsed.data;
  const identifier = merchantIdParam || merchantSlug;
  if (!identifier) {
    return NextResponse.json(
      { error: 'merchant_id or merchant_slug is required' },
      { status: 400 }
    );
  }

  const result = await generateFacebookCatalogFeedForIdentifier({
    identifier,
    isBySlug: !merchantIdParam && !!merchantSlug,
  });

  if (result.success) {
    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...CACHE_HEADERS.LONG,
      },
    });
  }

  if (result.status === 404) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ error: result.error }, { status: 500 });
}
