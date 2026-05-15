import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { buildAgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import {
  buildUcpDiscoveryProfile,
  UCP_PROFILE_CACHE_CONTROL,
} from '@/lib/agentic/ucp-discovery-profile';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

export async function GET(request: Request) {
  const merchantResolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError: 'UCP profile is only available on storefront hosts',
    lookupError: 'Failed to build UCP profile',
  });

  if (!merchantResolution.success) {
    if (merchantResolution.status === 500) {
      console.error('UCP_PROFILE_ERROR:', merchantResolution.cause);
    }

    return NextResponse.json(
      { error: merchantResolution.error },
      { status: merchantResolution.status }
    );
  }

  const manifest = buildAgentCommerceManifest(
    merchantResolution.merchant,
    buildRequestBaseUrl(request)
  );

  return NextResponse.json(buildUcpDiscoveryProfile(manifest), {
    headers: {
      'Cache-Control': UCP_PROFILE_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
