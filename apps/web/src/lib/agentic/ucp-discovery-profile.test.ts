// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';
import { buildUcpDiscoveryProfile } from '@/lib/agentic/ucp-discovery-profile';

const checkoutAuth: NonNullable<AgentCommerceManifest['auth']> = {
  bearer: {
    header: 'Authorization',
    scheme: 'Bearer',
  },
  request_signing: {
    algorithm: 'hmac-sha256',
    mutation_required_headers: [
      'api-version',
      'authorization',
      'request-id',
      'signature',
      'timestamp',
      'idempotency-key',
    ],
    required_headers: [
      'api-version',
      'authorization',
      'request-id',
      'signature',
      'timestamp',
    ],
    signed_payload:
      'json(api_version, body, idempotency_key, method, pathname, request_id, timestamp)',
  },
  supported_api_versions: ['2026-04-30', '2026-04-01'],
  type: 'bearer_hmac',
};

const baseManifest: AgentCommerceManifest = {
  auth: null,
  capabilities: ['catalog.read'],
  links: {
    feeds: {
      agent_products: 'https://ogabassey.com/feeds/agent-products.jsonl',
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
  },
  payment_methods: [],
  platform: 'baci',
  schema_version: '2026-04-30',
  store: {
    canonical_origin: 'https://ogabassey.com',
    name: 'Ogabassey',
    slug: 'ogabassey',
  },
};

describe('buildUcpDiscoveryProfile', () => {
  it('keeps catalog discovery in Baci extensions without advertising checkout', () => {
    const profile = buildUcpDiscoveryProfile(baseManifest);

    expect(profile.ucp.version).toBe('2026-04-08');
    expect(profile.ucp.capabilities).toMatchObject({
      'com.usebaci.catalog.read': [
        expect.objectContaining({ version: '2026-04-30' }),
      ],
    });
    expect(
      profile.ucp.capabilities['dev.ucp.shopping.checkout']
    ).toBeUndefined();
    expect(profile.ucp.payment_handlers).toEqual({});
    expect(profile.extensions.baci.capabilities).toEqual(['catalog.read']);
  });

  it('maps configured checkout methods into UCP capability and handler declarations', () => {
    const manifest: AgentCommerceManifest = {
      ...baseManifest,
      auth: checkoutAuth,
      capabilities: [
        'catalog.read',
        'checkout.session.create',
        'checkout.session.complete',
        'order.read',
      ],
      payment_methods: ['paystack_bank_transfer'],
    };

    const profile = buildUcpDiscoveryProfile(manifest);

    expect(profile.ucp.capabilities).toMatchObject({
      'dev.ucp.shopping.checkout': [
        expect.objectContaining({ version: '2026-04-08' }),
      ],
      'dev.ucp.shopping.order': [
        expect.objectContaining({ version: '2026-04-08' }),
      ],
    });
    expect(profile.ucp.payment_handlers).toMatchObject({
      'com.paystack.bank_transfer': [
        expect.objectContaining({ id: 'paystack_bank_transfer' }),
      ],
    });
    expect(profile.extensions.baci.auth).toMatchObject({
      type: 'bearer_hmac',
    });
  });

  it('handles empty Baci capabilities and pay-on-delivery without checkout auth', () => {
    const manifest: AgentCommerceManifest = {
      ...baseManifest,
      capabilities: [],
      payment_methods: ['pay_on_delivery'],
    };

    const profile = buildUcpDiscoveryProfile(manifest);

    expect(
      profile.ucp.capabilities['dev.ucp.shopping.checkout']
    ).toBeUndefined();
    expect(profile.ucp.payment_handlers).toMatchObject({
      'com.usebaci.pay_on_delivery': [
        expect.objectContaining({ id: 'pay_on_delivery' }),
      ],
    });
    expect(profile.extensions.baci.capabilities).toEqual([]);
    expect(profile.extensions.baci.auth).toBeNull();
  });
});
