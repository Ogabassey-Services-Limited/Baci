import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import {
  ACP_DISCOVERY_CACHE_CONTROL,
  buildAcpDiscoveryProfile,
} from '@/lib/agentic/acp-discovery-profile';
import { buildAgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

export async function GET(request: Request) {
  const merchantResolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError: 'ACP discovery is only available on storefront hosts',
    lookupError: 'Failed to build ACP discovery',
  });

  if (!merchantResolution.success) {
    if (merchantResolution.status === 500) {
      console.error('ACP_DISCOVERY_ERROR:', merchantResolution.cause);
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
  const profile = buildAcpDiscoveryProfile(manifest);

  if (!hasAcpServices(profile)) {
    return NextResponse.json(
      { error: 'ACP discovery is not enabled for this storefront' },
      { status: 404 }
    );
  }

  return NextResponse.json(profile, {
    headers: {
      'Cache-Control': ACP_DISCOVERY_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}

function hasAcpServices(
  profile: ReturnType<typeof buildAcpDiscoveryProfile>
): boolean {
  return profile.capabilities.services.length > 0;
}
