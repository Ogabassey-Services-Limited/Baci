import {
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  type AgenticPaymentMethod,
} from '@/config/agentic-payment-methods';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';

export const UCP_PROFILE_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';
export const UCP_PROFILE_VERSION = '2026-04-08';
const UCP_PROFILE_BASE_URL = `https://ucp.dev/${UCP_PROFILE_VERSION}`;
const UCP_SPEC_BASE_URL = `${UCP_PROFILE_BASE_URL}/specification`;
const UCP_SHOPPING_REST_SCHEMA_URL = `${UCP_PROFILE_BASE_URL}/services/shopping/rest.openapi.json`;

const UCP_CHECKOUT_CAPABILITY = 'dev.ucp.shopping.checkout';
const UCP_ORDER_CAPABILITY = 'dev.ucp.shopping.order';
const UCP_SHOPPING_SERVICE = 'dev.ucp.shopping';
const UCP_SHOPPING_SPEC_URL = `${UCP_SPEC_BASE_URL}/overview`;
const UCP_CHECKOUT_SPEC_URL = `${UCP_SPEC_BASE_URL}/checkout`;
const UCP_ORDER_SPEC_URL = `${UCP_SPEC_BASE_URL}/order`;

const CHECKOUT_SESSION_CAPABILITIES = [
  'checkout.session.create',
  'checkout.session.read',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
] as const;

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

export function buildUcpDiscoveryProfile(manifest: AgentCommerceManifest) {
  const agentCommerceManifestUrl = buildUrl(
    manifest.store.canonical_origin,
    STOREFRONT_AGENT_ROUTES.manifest
  );
  const agenticApiBaseUrl = buildUrl(
    manifest.store.canonical_origin,
    STOREFRONT_AGENT_ROUTES.agenticApiBase
  );
  return {
    ucp: {
      version: UCP_PROFILE_VERSION,
      services: buildUcpServices({
        agenticApiBaseUrl,
        manifest,
      }),
      capabilities: buildUcpCapabilities({
        agenticApiBaseUrl,
        agentCommerceManifestUrl,
        manifest,
      }),
      payment_handlers: buildUcpPaymentHandlers(
        agentCommerceManifestUrl,
        manifest.payment_methods,
        manifest.schema_version
      ),
    },
    signing_keys: [],
    store: manifest.store,
    links: {
      agent_commerce_manifest: agentCommerceManifestUrl,
      agentic_api_base: agenticApiBaseUrl,
      llms: manifest.links.llms,
      llms_full: manifest.links.llms_full,
      trust: manifest.links.trust,
      product_feed: manifest.links.product_feed,
      feeds: manifest.links.feeds,
      product_api: manifest.links.product_api,
    },
    extensions: {
      baci: {
        schema_version: manifest.schema_version,
        capabilities: manifest.capabilities,
        payment_methods: manifest.payment_methods,
        auth: manifest.auth,
        links: manifest.links,
      },
    },
  };
}

function buildUcpCapabilities({
  agenticApiBaseUrl,
  agentCommerceManifestUrl,
  manifest,
}: {
  agenticApiBaseUrl: string;
  agentCommerceManifestUrl: string;
  manifest: AgentCommerceManifest;
}) {
  const capabilities: Record<string, unknown[]> = {};

  if (manifest.capabilities.includes('catalog.read')) {
    capabilities['com.usebaci.catalog.read'] = [
      {
        version: manifest.schema_version,
        spec: agentCommerceManifestUrl,
        config: {
          feed: manifest.links.product_feed,
          product_api: manifest.links.product_api,
        },
      },
    ];
  }

  const checkoutCapability = buildUcpCheckoutCapability({
    agenticApiBaseUrl,
    manifest,
  });
  if (checkoutCapability) {
    capabilities[UCP_CHECKOUT_CAPABILITY] = [checkoutCapability];
  }

  const orderCapability = buildUcpOrderCapability({
    agenticApiBaseUrl,
    manifest,
  });
  if (orderCapability) {
    capabilities[UCP_ORDER_CAPABILITY] = [orderCapability];
  }

  return capabilities;
}

function hasPresentString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasCheckoutLinks(manifest: AgentCommerceManifest): boolean {
  return [
    manifest.links.checkout_sessions,
    manifest.links.checkout_session,
    manifest.links.checkout_session_complete,
    manifest.links.checkout_session_cancel,
  ].every(hasPresentString);
}

function hasCheckoutCapabilities(manifest: AgentCommerceManifest): boolean {
  return CHECKOUT_SESSION_CAPABILITIES.every((capability) =>
    manifest.capabilities.includes(capability)
  );
}

function hasOrderCapability(manifest: AgentCommerceManifest): boolean {
  return (
    manifest.capabilities.includes('order.read') &&
    hasPresentString(manifest.links.order)
  );
}

function buildUcpServices({
  agenticApiBaseUrl,
  manifest,
}: {
  agenticApiBaseUrl: string;
  manifest: AgentCommerceManifest;
}) {
  const hasShoppingCapability =
    (hasCheckoutCapabilities(manifest) && hasCheckoutLinks(manifest)) ||
    hasOrderCapability(manifest);

  if (!hasShoppingCapability) {
    return {};
  }

  return {
    [UCP_SHOPPING_SERVICE]: [
      {
        endpoint: agenticApiBaseUrl,
        schema: UCP_SHOPPING_REST_SCHEMA_URL,
        spec: UCP_SHOPPING_SPEC_URL,
        transport: 'rest',
        version: UCP_PROFILE_VERSION,
      },
    ],
  };
}

function toUcpOperationUrlTemplate(url: string): string {
  return url
    .replace(/\{session_id\}/g, '{id}')
    .replace(/\{order_id\}/g, '{id}');
}

function buildUcpCheckoutCapability({
  agenticApiBaseUrl,
  manifest,
}: {
  agenticApiBaseUrl: string;
  manifest: AgentCommerceManifest;
}) {
  if (!hasCheckoutCapabilities(manifest) || !hasCheckoutLinks(manifest)) {
    return null;
  }
  const {
    checkout_session_cancel: checkoutSessionCancel,
    checkout_session_complete: checkoutSessionComplete,
    checkout_sessions: checkoutSessions,
    checkout_session: checkoutSession,
  } = manifest.links;
  if (
    !checkoutSessionCancel ||
    !checkoutSessionComplete ||
    !checkoutSessions ||
    !checkoutSession
  ) {
    return null;
  }

  return {
    version: UCP_PROFILE_VERSION,
    spec: UCP_CHECKOUT_SPEC_URL,
    config: {
      auth: manifest.auth
        ? {
            supported_api_versions: manifest.auth.supported_api_versions,
            type: manifest.auth.type,
          }
        : null,
      rest: {
        endpoint: agenticApiBaseUrl,
        operations: {
          cancel_checkout: toUcpOperationUrlTemplate(checkoutSessionCancel),
          complete_checkout: toUcpOperationUrlTemplate(checkoutSessionComplete),
          create_checkout: toUcpOperationUrlTemplate(checkoutSessions),
          get_checkout: toUcpOperationUrlTemplate(checkoutSession),
          update_checkout: toUcpOperationUrlTemplate(checkoutSession),
        },
      },
    },
  };
}

function buildUcpOrderCapability({
  agenticApiBaseUrl,
  manifest,
}: {
  agenticApiBaseUrl: string;
  manifest: AgentCommerceManifest;
}) {
  const orderLink = manifest.links.order;
  if (!hasOrderCapability(manifest) || !hasPresentString(orderLink)) {
    return null;
  }

  return {
    version: UCP_PROFILE_VERSION,
    spec: UCP_ORDER_SPEC_URL,
    config: {
      auth: manifest.auth
        ? {
            supported_api_versions: manifest.auth.supported_api_versions,
            type: manifest.auth.type,
          }
        : null,
      rest: {
        endpoint: agenticApiBaseUrl,
        operations: {
          get_order: toUcpOperationUrlTemplate(orderLink),
        },
      },
    },
  };
}

function buildUcpPaymentHandlers(
  agentCommerceManifestUrl: string,
  paymentMethods: AgenticPaymentMethod[],
  manifestVersion: string
) {
  const handlers: Record<string, unknown[]> = {};

  if (paymentMethods.includes(AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER)) {
    handlers['com.paystack.bank_transfer'] = [
      {
        id: AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
        version: UCP_PROFILE_VERSION,
        spec: 'https://paystack.com/docs/payments/bank-transfer/',
        available_instruments: [{ type: 'bank_transfer', currency: 'NGN' }],
      },
    ];
  }

  if (paymentMethods.includes(AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY)) {
    handlers['com.usebaci.pay_on_delivery'] = [
      {
        id: AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
        version: manifestVersion,
        spec: agentCommerceManifestUrl,
        available_instruments: [{ type: 'pay_on_delivery' }],
      },
    ];
  }

  return handlers;
}
