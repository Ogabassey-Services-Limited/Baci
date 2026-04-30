import { NextResponse } from 'next/server';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import { getRootDomain } from '@/env';
import { getConfiguredAgenticMerchantSlug } from '@/lib/agentic/merchant-context';
import { isValidPaystackSubaccountCode } from '@/lib/agentic/paystack';
import {
  AGENTIC_API_VERSION,
  PREVIOUS_AGENTIC_API_VERSION,
} from '@/lib/agentic/request-integrity';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import { buildRequestBaseUrl } from '@/lib/storefront-host';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-30';
// Keep capability discovery fresh enough for incident response because
// checkout availability depends on merchant/payment environment state.
const AGENT_COMMERCE_CACHE_CONTROL = 'public, max-age=300';
const AGENT_COMMERCE_CAPABILITIES = [
  'catalog.read',
  'checkout.session.create',
  'checkout.session.read',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
] as const;
const AGENTIC_REQUIRED_HEADERS = [
  'api-version',
  'authorization',
  'request-id',
  'signature',
  'timestamp',
] as const;
const AGENTIC_MUTATION_REQUIRED_HEADERS = [
  ...AGENTIC_REQUIRED_HEADERS,
  'idempotency-key',
] as const;
const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

function buildTemplateUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
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
  const checkoutEnabled =
    slug === getConfiguredAgenticMerchantSlug() &&
    isValidPaystackSubaccountCode(merchant.paystack_subaccount_code);
  const checkoutLinks = checkoutEnabled ? buildCheckoutLinks(baseUrl) : {};

  return NextResponse.json(
    {
      schema_version: AGENT_COMMERCE_SCHEMA_VERSION,
      platform: 'baci',
      store: {
        slug,
        name: merchant.business_name,
        canonical_origin: baseUrl,
      },
      capabilities: checkoutEnabled
        ? [...AGENT_COMMERCE_CAPABILITIES]
        : ['catalog.read'],
      auth: checkoutEnabled ? buildAgenticCheckoutAuth() : null,
      links: {
        llms: buildUrl(baseUrl, '/llms.txt'),
        llms_full: buildUrl(baseUrl, '/llms-full.txt'),
        product_feed: buildUrl(
          baseUrl,
          STOREFRONT_FEED_ROUTES.openaiProductFeed
        ),
        feeds: {
          agent_products: buildUrl(
            baseUrl,
            STOREFRONT_FEED_ROUTES.agentProducts
          ),
          google_merchant_xml: buildUrl(
            baseUrl,
            STOREFRONT_FEED_ROUTES.googleMerchantXml
          ),
        },
        product_api: buildUrl(
          baseUrl,
          `/api/storefront/${encodeURIComponent(slug)}/products`
        ),
        ...checkoutLinks,
        ...buildAgentPolicyUrls(baseUrl),
      },
    },
    {
      headers: {
        'Cache-Control': AGENT_COMMERCE_CACHE_CONTROL,
      },
    }
  );
}

function buildAgenticCheckoutAuth() {
  return {
    type: 'bearer_hmac',
    bearer: {
      header: 'Authorization',
      scheme: 'Bearer',
    },
    request_signing: {
      algorithm: 'hmac-sha256',
      required_headers: [...AGENTIC_REQUIRED_HEADERS],
      mutation_required_headers: [...AGENTIC_MUTATION_REQUIRED_HEADERS],
      signed_payload:
        'json(api_version, body, idempotency_key, method, pathname, request_id, timestamp)',
    },
    supported_api_versions: [AGENTIC_API_VERSION, PREVIOUS_AGENTIC_API_VERSION],
  };
}

function buildCheckoutLinks(baseUrl: string) {
  return {
    checkout_sessions: buildUrl(baseUrl, '/api/agentic/checkout_sessions'),
    checkout_session: buildTemplateUrl(
      baseUrl,
      '/api/agentic/checkout_sessions/{session_id}'
    ),
    checkout_session_complete: buildTemplateUrl(
      baseUrl,
      '/api/agentic/checkout_sessions/{session_id}/complete'
    ),
    checkout_session_cancel: buildTemplateUrl(
      baseUrl,
      '/api/agentic/checkout_sessions/{session_id}/cancel'
    ),
  };
}
