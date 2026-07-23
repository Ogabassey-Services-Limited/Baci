import { NextResponse } from 'next/server';
import { AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS } from '@/config/agentic-payment-discovery-cache';
import { getRootDomain } from '@/env';
import { buildAgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildBaciPlatformUcpProfile } from '@/lib/agentic/baci-platform-ucp-profile';
import { buildUcpDiscoveryProfile } from '@/lib/agentic/ucp-discovery-profile';
import {
  buildRequestBaseUrl,
  getRequestHost,
  stripPort,
} from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

export async function GET(request: Request) {
  const hostname = stripPort(getRequestHost(request));
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.json(
      buildBaciPlatformUcpProfile(buildRequestBaseUrl(request)),
      {
        headers: AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS,
      }
    );
  }

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
    headers: AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS,
  });
}
