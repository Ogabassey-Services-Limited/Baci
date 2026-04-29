import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-28';
const PHASE_ONE_CAPABILITIES = ['catalog.read'] as const;
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

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
  const slug = merchant.slug;
  const productFeedUrl = new URL('/api/feed/openai', baseUrl);
  productFeedUrl.searchParams.set('merchant_slug', slug);
  const agentProductsUrl = new URL('/api/feed/openai', baseUrl);
  agentProductsUrl.searchParams.set('merchant_slug', slug);
  agentProductsUrl.searchParams.set('format', 'current');

  return NextResponse.json(
    {
      schema_version: AGENT_COMMERCE_SCHEMA_VERSION,
      platform: 'baci',
      store: {
        slug,
        name: merchant.business_name,
        canonical_origin: baseUrl,
      },
      capabilities: [...PHASE_ONE_CAPABILITIES],
      auth: null,
      links: {
        llms: buildUrl(baseUrl, '/llms.txt'),
        llms_full: buildUrl(baseUrl, '/llms-full.txt'),
        product_feed: productFeedUrl.toString(),
        feeds: {
          agent_products: agentProductsUrl.toString(),
          google_merchant_xml: buildUrl(baseUrl, '/feeds/google-merchant.xml'),
        },
        product_api: buildUrl(
          baseUrl,
          `/api/storefront/${encodeURIComponent(slug)}/products`
        ),
        ...buildAgentPolicyUrls(baseUrl),
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
