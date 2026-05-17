import { describe, expect, it } from 'vitest';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildAgentNativeCommerceProof } from '@/lib/agentic/agent-native-commerce-proof';
import type { AgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';

const baseUrl = 'https://ogabassey.com';

function manifest(
  overrides: Partial<AgentCommerceManifest> = {}
): AgentCommerceManifest {
  return {
    auth: {
      bearer: {
        header: 'Authorization',
        scheme: 'Bearer',
      },
      request_signing: {
        algorithm: 'hmac-sha256',
        mutation_required_headers: ['api-version', 'idempotency-key'],
        required_headers: ['api-version'],
        signed_payload: 'json(...)',
      },
      supported_api_versions: ['2026-04-30'],
      type: 'bearer_hmac',
    },
    capabilities: [
      'catalog.read',
      'order.read',
      'checkout.session.create',
      'checkout.session.complete',
    ],
    links: {
      agent_native_commerce:
        'https://ogabassey.com/.well-known/agent-native-commerce',
      feeds: {
        agent_products: 'https://ogabassey.com/feeds/agent-products.jsonl',
        facebook_catalog_xml: 'https://ogabassey.com/feeds/facebook.xml',
        google_merchant_xml: 'https://ogabassey.com/feeds/google-merchant.xml',
      },
      llms: 'https://ogabassey.com/llms.txt',
      llms_full: 'https://ogabassey.com/llms-full.txt',
      privacy_policy_url: 'https://ogabassey.com/privacy',
      product_api: 'https://ogabassey.com/api/storefront/ogabassey/products',
      product_feed: 'https://ogabassey.com/feeds/openai.jsonl',
      return_policy_url: 'https://ogabassey.com/returns',
      shipping_policy_url: 'https://ogabassey.com/shipping',
      terms_of_service_url: 'https://ogabassey.com/terms',
      trust: 'https://ogabassey.com/agent-trust.json',
      checkout_sessions: 'https://ogabassey.com/api/agentic/checkout_sessions',
      order: 'https://ogabassey.com/api/agentic/orders/{order_id}',
    },
    payment_methods: ['paystack_bank_transfer'],
    platform: 'baci',
    schema_version: '2026-04-30',
    store: {
      canonical_origin: 'https://ogabassey.com',
      name: 'Ogabassey',
      slug: 'ogabassey',
    },
    ...overrides,
  };
}

function trustReadiness(
  overrides: Partial<AgentCommerceTrustReadiness> = {}
): AgentCommerceTrustReadiness {
  return {
    checks: [
      {
        id: 'catalog-surface-parity',
        label: 'Catalog surface parity',
        message: 'Catalogs match.',
        severity: 'pass',
      },
      {
        id: 'policy-coverage',
        label: 'Policy coverage',
        message: 'Policies are present.',
        severity: 'pass',
      },
    ],
    status: 'pass',
    surfaces: {
      agentCommerceManifest: 'https://ogabassey.com/agent-commerce.json',
      agentNativeCommerce:
        'https://ogabassey.com/.well-known/agent-native-commerce',
      agentTrust: 'https://ogabassey.com/agent-trust.json',
      currentProductFeed: 'https://ogabassey.com/feeds/agent-products.jsonl',
      googleMerchantXml: 'https://ogabassey.com/feeds/google-merchant.xml',
      openAiProductFeed: 'https://ogabassey.com/feeds/openai.jsonl',
      policies: {
        privacy_policy_url: 'https://ogabassey.com/privacy',
        return_policy_url: 'https://ogabassey.com/returns',
        shipping_policy_url: 'https://ogabassey.com/shipping',
        terms_of_service_url: 'https://ogabassey.com/terms',
      },
      productApi: 'https://ogabassey.com/api/storefront/ogabassey/products',
      robots: 'https://ogabassey.com/robots.txt',
      sitemap: 'https://ogabassey.com/sitemap.xml',
      ucpProfile: 'https://ogabassey.com/.well-known/ucp',
    },
    totals: {
      googleProducts: 1,
      latestProductUpdatedAt: '2026-05-10T00:00:00.000Z',
      openAiProducts: 1,
      priceMismatches: 0,
      productsWithStructuredData: 1,
      productsWithVerifiedImages: 1,
      sharedProducts: 1,
      staleProducts: 0,
      urlMismatches: 0,
    },
    ...overrides,
  };
}

describe('buildAgentNativeCommerceProof', () => {
  it('packages the reference merchant agent-native commerce proof', () => {
    const proof = buildAgentNativeCommerceProof({
      baseUrl,
      manifest: manifest(),
      trustReadiness: trustReadiness(),
    });

    expect(proof).toMatchObject({
      schema_version: '2026-05-15',
      platform: 'baci',
      positioning: {
        category: 'agent-native commerce infrastructure',
        reference_merchant: 'ogabassey',
      },
      proof: {
        status: 'pass',
        action: {
          payment_methods: ['paystack_bank_transfer'],
          signed_requests: true,
        },
        surfaces: {
          agent_commerce_manifest: 'https://ogabassey.com/agent-commerce.json',
          agent_native_commerce:
            'https://ogabassey.com/.well-known/agent-native-commerce',
          ucp_profile: 'https://ogabassey.com/.well-known/ucp',
        },
        trust: {
          checks: {
            fail: 0,
            pass: 2,
            total: 2,
            warn: 0,
          },
          status: 'pass',
        },
      },
    });
    expect(proof.proof.stages.map((stage) => stage.id)).toEqual([
      'discoverable',
      'trusted',
      'purchasable',
      'recoverable',
      'manageable',
    ]);
  });

  it('warns when checkout cannot yet create a signed purchase flow', () => {
    const proof = buildAgentNativeCommerceProof({
      baseUrl,
      manifest: manifest({
        auth: null,
        capabilities: ['catalog.read'],
        payment_methods: [],
      }),
      trustReadiness: trustReadiness(),
    });

    expect(proof.proof.status).toBe('warn');
    expect(
      proof.proof.stages.find((stage) => stage.id === 'purchasable')
    ).toMatchObject({
      evidence_url: null,
      status: 'warn',
    });
    expect(
      proof.proof.stages.find((stage) => stage.id === 'recoverable')
    ).toMatchObject({
      status: 'warn',
    });
  });

  it('fails the proof when trust readiness fails', () => {
    const proof = buildAgentNativeCommerceProof({
      baseUrl,
      manifest: manifest(),
      trustReadiness: trustReadiness({
        checks: [
          {
            id: 'canonical-url-parity',
            label: 'Canonical URL parity',
            message: 'URLs differ.',
            severity: 'fail',
          },
        ],
        status: 'fail',
      }),
    });

    expect(proof.proof.status).toBe('fail');
    expect(proof.proof.trust.checks).toMatchObject({
      fail: 1,
      pass: 0,
      total: 1,
      warn: 0,
    });
  });
});
