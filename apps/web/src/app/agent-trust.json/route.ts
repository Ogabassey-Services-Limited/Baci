import { NextResponse } from 'next/server';
import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { getRootDomain } from '@/env';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { buildAgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';

const AGENT_TRUST_SCHEMA_VERSION = '2026-05-11';
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();
const AGENT_TRUST_CACHE_CONTROL = 'public, max-age=300';

export async function GET(request: Request) {
  const merchantResolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError:
      'Agent trust readiness is only available on storefront hosts',
    lookupError: 'Failed to resolve storefront for agent trust readiness',
  });

  if (!merchantResolution.success) {
    if (merchantResolution.status === 500) {
      console.error('AGENT_TRUST_READINESS_ERROR:', merchantResolution.cause);
    }

    return NextResponse.json(
      { error: merchantResolution.error },
      { status: merchantResolution.status }
    );
  }

  const { merchant } = merchantResolution;
  const baseUrl = buildRequestBaseUrl(request);

  try {
    const [openAiFeedData, googleFeedData] = await Promise.all([
      getCachedOpenAIFeedData(merchant.id),
      getCachedGoogleMerchantFeedData(merchant.id, merchant.slug),
    ]);
    const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);

    return NextResponse.json(
      {
        schema_version: AGENT_TRUST_SCHEMA_VERSION,
        platform: 'baci',
        store: {
          slug: merchant.slug,
          name: merchant.business_name,
          canonical_origin: baseUrl,
        },
        trust: buildAgentCommerceTrustReadiness({
          baseUrl,
          googleFeedData,
          merchant,
          openAiFeedData,
          trustProfile,
        }),
      },
      {
        headers: {
          'Cache-Control': AGENT_TRUST_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error('AGENT_TRUST_READINESS_ERROR:', error);

    return NextResponse.json(
      { error: 'Failed to build agent trust readiness' },
      { status: 500 }
    );
  }
}
