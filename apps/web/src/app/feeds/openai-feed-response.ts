import { type NextRequest, NextResponse } from 'next/server';
import { generateCurrentOpenAIProductFeed } from '@/app/api/feed/openai/current-feed-generator';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import type { Merchant } from '@/app/api/feed/openai/feed-types';
import { generateOpenAIFeed } from '@/app/api/feed/openai/legacy-feed-generator';
import { getRootDomain } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();
const OPENAI_PRODUCT_FEED_NOT_FOUND_ERROR =
  'OpenAI product feed is only available on storefront hosts';
const OPENAI_PRODUCT_FEED_LOOKUP_ERROR =
  'Failed to resolve storefront for OpenAI product feed';

type PublicOpenAIFeedFormat = 'legacy' | 'current';
type OpenAIFeedMerchant = Pick<
  Merchant,
  | 'business_name'
  | 'country'
  | 'custom_domain'
  | 'id'
  | 'logo_url'
  | 'payout_currency'
  | 'slug'
>;

function toOpenAIFeedMerchant(
  merchant: OpenAIFeedMerchant
): OpenAIFeedMerchant {
  return {
    id: merchant.id,
    business_name: merchant.business_name,
    country: merchant.country,
    custom_domain: merchant.custom_domain,
    logo_url: merchant.logo_url,
    payout_currency: merchant.payout_currency,
    slug: merchant.slug,
  };
}

export async function createPublicOpenAIFeedResponse(
  request: NextRequest,
  format: PublicOpenAIFeedFormat
): Promise<NextResponse> {
  const resolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError: OPENAI_PRODUCT_FEED_NOT_FOUND_ERROR,
    lookupError: OPENAI_PRODUCT_FEED_LOOKUP_ERROR,
  });

  if (!resolution.success) {
    if (resolution.status === 500) {
      console.error('OPENAI_PUBLIC_FEED_RESOLUTION_ERROR:', resolution.cause);
    }

    return NextResponse.json(
      { error: resolution.error },
      { status: resolution.status }
    );
  }

  try {
    const merchant = toOpenAIFeedMerchant(resolution.merchant);
    const { products } = await getCachedOpenAIFeedData(merchant.id);
    const baseUrl = buildRequestBaseUrl(request);
    const feedLines =
      format === 'current'
        ? generateCurrentOpenAIProductFeed(products, merchant, baseUrl)
        : generateOpenAIFeed(products, merchant, baseUrl);

    return new NextResponse(feedLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        ...CACHE_HEADERS.SHORT,
      },
    });
  } catch (error) {
    console.error('OPENAI_PUBLIC_FEED_GENERATION_ERROR:', error);

    return NextResponse.json(
      { error: 'Failed to generate OpenAI product feed' },
      { status: 500 }
    );
  }
}
