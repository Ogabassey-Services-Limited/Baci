import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import {
  type CachedMerchant,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import {
  buildRequestBaseUrl,
  resolveStorefrontRouteIdentifiers,
} from '@/lib/storefront-host';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';

const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-28';
const PHASE_ONE_CAPABILITIES = ['catalog.read'] as const;
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

export async function GET(request: Request) {
  const routeIdentifiers = resolveStorefrontRouteIdentifiers({
    request,
    rootDomain: ROOT_DOMAIN,
  });
  const parsedRouteIdentifiers: string[] = [];

  // Identifier candidates are derived from the same host; reject malformed
  // hosts instead of falling through to a lower-priority fallback.
  for (const routeIdentifier of routeIdentifiers) {
    const parsedRouteIdentifier =
      RouteIdentifierSchema.safeParse(routeIdentifier);

    if (!parsedRouteIdentifier.success) {
      return NextResponse.json(
        { error: 'Invalid storefront host' },
        { status: 400 }
      );
    }

    parsedRouteIdentifiers.push(parsedRouteIdentifier.data);
  }

  let merchant: CachedMerchant | null = null;

  try {
    // Candidates are ordered by storefront-host priority. Non-www custom domains
    // intentionally win before the exact www fallback to match proxy behavior.
    for (const routeIdentifier of parsedRouteIdentifiers) {
      merchant = await getMerchantByIdentifier(routeIdentifier);

      if (merchant) {
        break;
      }
    }
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
