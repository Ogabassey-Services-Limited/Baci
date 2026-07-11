import { type NextRequest, NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { generateAgentRepairsFeed } from '@/lib/storefront-repairs/agent-repairs-feed';
import { getCachedRepairsFeedData } from '@/lib/storefront-repairs/repairs-feed-data';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();
const AGENT_REPAIRS_FEED_NOT_FOUND_ERROR =
  'Agent repairs feed is only available on storefront hosts';
const AGENT_REPAIRS_FEED_LOOKUP_ERROR =
  'Failed to resolve storefront for agent repairs feed';
const AGENT_REPAIRS_FEED_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60',
  'Vercel-CDN-Cache-Control':
    'public, s-maxage=300, stale-while-revalidate=3600',
} as const;

// Cold catalog materialization can exceed the platform's default 15s timeout;
// keep parity with the OpenAI/agent-products feeds.
export const maxDuration = 60;

/**
 * Public JSONL feed of a storefront's repair services, one line per active
 * quote. Kept separate from the product feeds because a bookable service is
 * not a purchasable product — agents must not conflate the two.
 */
export async function GET(request: NextRequest) {
  const resolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError: AGENT_REPAIRS_FEED_NOT_FOUND_ERROR,
    lookupError: AGENT_REPAIRS_FEED_LOOKUP_ERROR,
  });

  if (!resolution.success) {
    if (resolution.status === 500) {
      console.error('AGENT_REPAIRS_FEED_RESOLUTION_ERROR:', resolution.cause);
    }

    return NextResponse.json(
      { error: resolution.error },
      { status: resolution.status }
    );
  }

  try {
    const merchant = resolution.merchant;
    const { items } = await getCachedRepairsFeedData(merchant.id);
    const baseUrl = buildRequestBaseUrl(request);
    const feedLines = generateAgentRepairsFeed(
      items,
      {
        business_name: merchant.business_name,
        payout_currency: merchant.payout_currency,
        logo_url: merchant.logo_url,
      },
      baseUrl
    );

    return new NextResponse(feedLines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        ...AGENT_REPAIRS_FEED_CACHE_HEADERS,
      },
    });
  } catch (error) {
    console.error('AGENT_REPAIRS_FEED_GENERATION_ERROR:', error);

    return NextResponse.json(
      { error: 'Failed to generate agent repairs feed' },
      { status: 500 }
    );
  }
}
