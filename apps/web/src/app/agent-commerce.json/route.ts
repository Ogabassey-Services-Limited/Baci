import { NextResponse } from 'next/server';
import { AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS } from '@/config/agentic-payment-discovery-cache';
import { getRootDomain } from '@/env';
import { buildAgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

export async function GET(request: Request) {
  const merchantResolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError:
      'Agent commerce manifest is only available on storefront hosts',
    lookupError: 'Failed to build agent commerce manifest',
  });

  if (!merchantResolution.success) {
    if (merchantResolution.status === 500) {
      console.error('AGENT_COMMERCE_MANIFEST_ERROR:', merchantResolution.cause);
    }

    return NextResponse.json(
      { error: merchantResolution.error },
      { status: merchantResolution.status }
    );
  }

  const { merchant } = merchantResolution;
  const baseUrl = buildRequestBaseUrl(request);

  return NextResponse.json(buildAgentCommerceManifest(merchant, baseUrl), {
    headers: AGENTIC_PAYMENT_DISCOVERY_NO_STORE_HEADERS,
  });
}
