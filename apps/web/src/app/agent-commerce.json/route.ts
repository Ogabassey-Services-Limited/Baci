import { NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';

const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-28';
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

function getRequestHost(request: Request): string {
  const host = request.headers.get('host') || new URL(request.url).host || '';

  return host
    .split(',')[0]
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const closingBracketIndex = host.indexOf(']');
    return closingBracketIndex === -1
      ? host
      : host.slice(0, closingBracketIndex + 1);
  }

  return host.split(':')[0] || '';
}

function isLocalhostIdentifier(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}

function resolveManifestRouteIdentifier(request: Request): string {
  const hostname = stripPort(getRequestHost(request)).replace(/^www\./, '');

  if (!hostname || hostname === ROOT_DOMAIN) {
    return '';
  }

  if (isLocalhostIdentifier(hostname)) {
    return '';
  }

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return hostname.slice(0, -(ROOT_DOMAIN.length + 1));
  }

  return hostname;
}

function buildManifestBaseUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  return `${requestUrl.protocol}//${getRequestHost(request)}`;
}

export async function GET(request: Request) {
  const routeIdentifier = resolveManifestRouteIdentifier(request);
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

  const baseUrl = buildManifestBaseUrl(request);
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
      capabilities: [
        'catalog.read',
        'checkout.session.create',
        'checkout.session.update',
        'checkout.session.complete',
        'checkout.session.cancel',
        'order.read',
      ],
      auth: {
        type: 'bearer_hmac',
        required_headers: [
          'authorization',
          'idempotency-key',
          'request-id',
          'signature',
          'timestamp',
          'api-version',
        ],
      },
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
        checkout_sessions: buildUrl(baseUrl, '/api/agentic/checkout_sessions'),
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
