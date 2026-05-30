import {
  AGENTIC_PAYMENT_METHOD_GOOGLE_PAY,
  AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
  AGENTIC_PAYMENT_METHOD_PAYSTACK_BANK_TRANSFER,
} from '@/config/agentic-payment-methods';
import { STOREFRONT_AGENT_ROUTES } from '@/config/storefront-agent-routes';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { UCP_PROFILE_VERSION } from '@/lib/agentic/ucp-profile-constants';
import {
  buildUcpCapabilities,
  buildUcpServices,
} from '@/lib/agentic/ucp-shopping-profile';

export {
  UCP_PROFILE_CACHE_CONTROL,
  UCP_PROFILE_VERSION,
} from '@/lib/agentic/ucp-profile-constants';

const buildUrl = (baseUrl: string, path: string): string =>
  new URL(path, baseUrl).toString();

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
      services: buildUcpServices({ agenticApiBaseUrl, manifest }),
      capabilities: buildUcpCapabilities({
        agenticApiBaseUrl,
        agentCommerceManifestUrl,
        manifest,
      }),
      payment_handlers: buildUcpPaymentHandlers(
        agentCommerceManifestUrl,
        manifest
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

function buildUcpPaymentHandlers(
  agentCommerceManifestUrl: string,
  manifest: Pick<
    AgentCommerceManifest,
    'payment_handler_configs' | 'payment_methods' | 'schema_version'
  >
) {
  const handlers: Record<string, unknown[]> = {};
  const paymentMethods = manifest.payment_methods;

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
        version: manifest.schema_version,
        spec: agentCommerceManifestUrl,
        available_instruments: [{ type: 'pay_on_delivery' }],
      },
    ];
  }

  if (paymentMethods.includes(AGENTIC_PAYMENT_METHOD_GOOGLE_PAY)) {
    const googlePayConfig = manifest.payment_handler_configs?.google_pay;
    if (googlePayConfig?.gateway === 'paystack') {
      handlers['com.google.pay'] = [
        {
          id: AGENTIC_PAYMENT_METHOD_GOOGLE_PAY,
          version: UCP_PROFILE_VERSION,
          spec: 'https://developers.google.com/pay/api/web/overview',
          available_instruments: [{ type: 'google_pay', currency: 'NGN' }],
          config: {
            gateway: googlePayConfig.gateway,
            gateway_merchant_id: googlePayConfig.gatewayMerchantId,
            merchant_id: googlePayConfig.merchantId,
          },
        },
      ];
    }
  }

  return handlers;
}
