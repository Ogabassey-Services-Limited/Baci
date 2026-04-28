import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import {
  buildRequestBaseUrl,
  resolveStorefrontRouteIdentifier,
} from '@/lib/storefront-host';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';

const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-28';
const PHASE_ONE_CAPABILITIES = ['catalog.read'] as const;
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

export async function GET(request: Request) {
  const routeIdentifier = resolveStorefrontRouteIdentifier({
    request,
    rootDomain: ROOT_DOMAIN,
  });
  const parsedRouteIdentifier = routeIdentifier
    ? RouteIdentifierSchema.safeParse(routeIdentifier)
    : null;

  if (routeIdentifier && !parsedRouteIdentifier?.success) {
    return NextResponse.json(
      { error: 'Invalid storefront host' },
      { status: 400 }
    );
  }

  let merchant = null;

  try {
    merchant = parsedRouteIdentifier?.success
      ? await getMerchantByIdentifier(parsedRouteIdentifier.data)
      : null;
  } catch (error) {
    console.error('AGENT_COMMERCE_MANIFEST_ERROR:', error);
    return NextResponse.json(
      { error: 'Failed to build agent commerce manifest' },
      { status: 500 }
    );
  }

  if (!merchant) {
    return NextResponse.json(
      {
        error: 'Agent commerce manifest is only available on storefront hosts',
      },
      { status: 404 }
    );
  }

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
