import {
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  type AgenticPaymentMethod,
} from '@/config/agentic-payment-methods';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import { STOREFRONT_FEED_ROUTES } from '@/config/storefront-feed-routes';
import { getPaystackSecretKey } from '@/env';
import {
  getConfiguredAgenticMerchantSlug,
  isAgenticCheckoutRuntimeConfigured,
} from '@/lib/agentic/merchant-context';
import { isValidPaystackSubaccountCode } from '@/lib/agentic/paystack';
import {
  AGENTIC_API_VERSION,
  PREVIOUS_AGENTIC_API_VERSION,
} from '@/lib/agentic/request-integrity';
import type { CachedMerchant } from '@/lib/cached-data';
import {
  type AgentPolicyUrls,
  buildAgentPolicyUrls,
} from '@/lib/storefront-agent-urls';

export const AGENT_COMMERCE_SCHEMA_VERSION = '2026-04-30';
export const AGENT_COMMERCE_CACHE_CONTROL = 'public, max-age=300';

const AGENT_COMMERCE_CAPABILITIES = [
  'catalog.read',
  'checkout.session.create',
  'checkout.session.read',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
  'order.read',
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

type MerchantPaymentConfig = Pick<
  CachedMerchant,
  'business_name' | 'feature_settings' | 'paystack_subaccount_code' | 'slug'
>;

type AgentCommerceCheckoutLinks = {
  checkout_session: string;
  checkout_session_cancel: string;
  checkout_session_complete: string;
  checkout_sessions: string;
  order: string;
};

type AgentCommerceLinks = AgentPolicyUrls &
  Partial<AgentCommerceCheckoutLinks> & {
    feeds: {
      agent_products: string;
      google_merchant_xml: string;
    };
    llms: string;
    llms_full: string;
    product_api: string;
    product_feed: string;
    trust: string;
  };

export type AgentCommerceManifest = {
  auth: ReturnType<typeof buildAgenticCheckoutAuth> | null;
  capabilities: string[];
  links: AgentCommerceLinks;
  payment_methods: AgenticPaymentMethod[];
  platform: 'baci';
  schema_version: typeof AGENT_COMMERCE_SCHEMA_VERSION;
  store: {
    canonical_origin: string;
    name: string;
    slug: string;
  };
};

export function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

/**
 * buildTemplateUrl preserves placeholders like {session_id}; buildUrl uses URL
 * for concrete paths where braces should not be string-concatenated.
 */
export function buildTemplateUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function buildAgentCommerceManifest(
  merchant: MerchantPaymentConfig,
  baseUrl: string
): AgentCommerceManifest {
  const paymentMethods = buildAgenticPaymentMethods(merchant);
  const checkoutEnabled =
    isAgenticCheckoutRuntimeConfigured() &&
    merchant.slug === getConfiguredAgenticMerchantSlug() &&
    paymentMethods.length > 0;
  const checkoutLinks = checkoutEnabled ? buildCheckoutLinks(baseUrl) : {};

  return {
    schema_version: AGENT_COMMERCE_SCHEMA_VERSION,
    platform: 'baci',
    store: {
      slug: merchant.slug,
      name: merchant.business_name,
      canonical_origin: baseUrl,
    },
    capabilities: checkoutEnabled
      ? [...AGENT_COMMERCE_CAPABILITIES]
      : ['catalog.read'],
    payment_methods: checkoutEnabled ? paymentMethods : [],
    auth: checkoutEnabled ? buildAgenticCheckoutAuth() : null,
    links: {
      llms: buildUrl(baseUrl, '/llms.txt'),
      llms_full: buildUrl(baseUrl, '/llms-full.txt'),
      trust: buildUrl(baseUrl, STOREFRONT_AGENT_ROUTES.trust),
      product_feed: buildUrl(baseUrl, STOREFRONT_FEED_ROUTES.openaiProductFeed),
      feeds: {
        agent_products: buildUrl(baseUrl, STOREFRONT_FEED_ROUTES.agentProducts),
        google_merchant_xml: buildUrl(
          baseUrl,
          STOREFRONT_FEED_ROUTES.googleMerchantXml
        ),
      },
      product_api: buildUrl(
        baseUrl,
        `/api/storefront/${encodeURIComponent(merchant.slug)}/products`
      ),
      ...checkoutLinks,
      ...buildAgentPolicyUrls(baseUrl),
    },
  };
}

function buildAgenticPaymentMethods(merchant: MerchantPaymentConfig) {
  const methods: AgenticPaymentMethod[] = [];
  if (
    getPaystackSecretKey() &&
    isValidPaystackSubaccountCode(merchant.paystack_subaccount_code)
  ) {
    methods.push(AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER);
  }
  const payOnDeliveryEnabled =
    merchant.feature_settings?.pay_on_delivery_enabled;
  if (payOnDeliveryEnabled === true) {
    methods.push(AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY);
  }
  return methods;
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
    order: buildTemplateUrl(baseUrl, '/api/agentic/orders/{order_id}'),
  };
}
