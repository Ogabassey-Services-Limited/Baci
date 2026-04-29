import { type NextRequest, NextResponse } from 'next/server';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { googleMerchantFeedQuerySchema } from '@/schemas/google-merchant-feed-query';
import { generateGoogleMerchantFeed } from './feed-builder';
import { getCachedGoogleMerchantFeedData } from './feed-data';
import { buildMerchantBaseUrl } from './route-utils';

/**
 * Google Merchant Center Product Feed API
 *
 * Generates an XML feed compatible with Google Merchant Center.
 * Image URLs are resolved exclusively from the prevalidated
 * `product_feed_images` manifest — zero live network validation.
 *
 * @see https://support.google.com/merchants/answer/7052112
 *
 * Usage: /api/feed/google-merchant?merchant_id=xxx
 * or: /api/feed/google-merchant?merchant_slug=xxx
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

  try {
    const identifier = merchantIdParam || merchantSlug || '';
    const isBySlug = !merchantIdParam && !!merchantSlug;
    const resolvedMerchant = await resolveFeedMerchant(identifier, isBySlug);

    const { custom_domain, slug, products, imageManifest } =
      await getCachedGoogleMerchantFeedData(
        resolvedMerchant.id,
        resolvedMerchant.slug
      );

    const merchant = {
      ...resolvedMerchant,
      custom_domain,
    };

    const baseUrl = buildMerchantBaseUrl({ slug, custom_domain });

    const feedXml = generateGoogleMerchantFeed(
      products,
      merchant,
      baseUrl,
      imageManifest
    );

    return new NextResponse(feedXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...CACHE_HEADERS.LONG,
      },
    });
  } catch (error) {
    console.error('FEED_GENERATION_ERROR:', error);
    if (error instanceof MerchantNotFoundError) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate feed' },
      { status: 500 }
    );
  }
}
