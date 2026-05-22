import { NextResponse } from 'next/server';
import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { getRootDomain } from '@/env';
import { buildAgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildAgentNativeCommerceProof } from '@/lib/agentic/agent-native-commerce-proof';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { buildAgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { enrichMerchantReviewAuthority } from '@/lib/storefront-trust/enrich-merchant-review-authority';

const AGENT_NATIVE_COMMERCE_CACHE_CONTROL = 'public, max-age=300';
const AGENT_NATIVE_COMMERCE_CDN_CACHE_CONTROL = 'no-store';
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

export async function GET(request: Request) {
  const merchantResolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError:
      'Agent-native commerce proof is only available on storefront hosts',
    lookupError: 'Failed to build agent-native commerce proof',
  });

  if (!merchantResolution.success) {
    if (merchantResolution.status === 500) {
      console.error(
        'AGENT_NATIVE_COMMERCE_PROOF_ERROR:',
        merchantResolution.cause
      );
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
      getCachedOpenAIFeedData(merchant.id, true),
      getCachedGoogleMerchantFeedData(merchant.id, merchant.slug),
    ]);
    const trustProfile = await enrichMerchantReviewAuthority(
      buildMerchantTrustProfile(merchant, baseUrl)
    );
    const trustReadiness = buildAgentCommerceTrustReadiness({
      baseUrl,
      googleFeedData,
      merchant,
      openAiFeedData,
      trustProfile,
    });
    const manifest = buildAgentCommerceManifest(merchant, baseUrl);

    return NextResponse.json(
      buildAgentNativeCommerceProof({
        baseUrl,
        manifest,
        trustReadiness,
      }),
      {
        headers: {
          'Cache-Control': AGENT_NATIVE_COMMERCE_CACHE_CONTROL,
          'Vercel-CDN-Cache-Control': AGENT_NATIVE_COMMERCE_CDN_CACHE_CONTROL,
        },
      }
    );
  } catch (error) {
    console.error('AGENT_NATIVE_COMMERCE_PROOF_ERROR:', error);

    return NextResponse.json(
      { error: 'Failed to build agent-native commerce proof' },
      { status: 500 }
    );
  }
}
