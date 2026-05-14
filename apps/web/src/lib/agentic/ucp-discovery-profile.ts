import {
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
  type AgenticPaymentMethod,
} from '@/config/agentic-payment-methods';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';

export const UCP_PROFILE_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';
export const UCP_PROFILE_VERSION = '2026-04-08';

const UCP_SPEC_OVERVIEW_URL = `https://ucp.dev/${UCP_PROFILE_VERSION}/specification/overview/`;
const UCP_REST_SCHEMA_URL = `https://ucp.dev/${UCP_PROFILE_VERSION}/services/shopping/rest.openapi.json`;

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
      services: {
        'dev.ucp.shopping': [
          {
            version: UCP_PROFILE_VERSION,
            spec: UCP_SPEC_OVERVIEW_URL,
            schema: UCP_REST_SCHEMA_URL,
            transport: 'rest',
            endpoint: agenticApiBaseUrl,
            config: {
              baci_api_base: agenticApiBaseUrl,
              baci_manifest: agentCommerceManifestUrl,
              native_ucp_operations: false,
            },
          },
        ],
      },
      capabilities: buildUcpCapabilities({
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
  agentCommerceManifestUrl,
  manifest,
}: {
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

  return capabilities;
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
