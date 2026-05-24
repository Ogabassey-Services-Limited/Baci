import { describe, expect, it } from 'vitest';
import { buildAcpDiscoveryProfile } from '@/lib/agentic/acp-discovery-profile';
import type { AgentCommerceManifest } from '@/lib/agentic/agent-commerce-manifest';

function buildManifest(
  overrides: Partial<AgentCommerceManifest> = {}
): AgentCommerceManifest {
  return {
    auth: {
      type: 'bearer_hmac',
      bearer: {
        header: 'Authorization',
        scheme: 'Bearer',
      },
      request_signing: {
        algorithm: 'hmac-sha256',
        required_headers: ['api-version'],
        mutation_required_headers: ['api-version', 'idempotency-key'],
        optional_identity_headers: ['agent-id'],
        signed_payload:
          'json(api_version, body, idempotency_key, method, pathname, request_id, timestamp, optional agent_id)',
      },
      supported_api_versions: ['2026-04-30', '2026-04-17', '2026-01-01'],
    },
    capabilities: [
      'catalog.read',
      'order.read',
      'checkout.session.create',
      'checkout.session.read',
      'checkout.session.update',
      'checkout.session.complete',
      'checkout.session.cancel',
    ],
    links: {
      agent_native_commerce:
        'https://ogabassey.com/.well-known/agent-native-commerce',
      checkout_session:
        'https://ogabassey.com/api/agentic/checkout_sessions/{session_id}',
      checkout_session_cancel:
        'https://ogabassey.com/api/agentic/checkout_sessions/{session_id}/cancel',
      checkout_session_complete:
        'https://ogabassey.com/api/agentic/checkout_sessions/{session_id}/complete',
      checkout_sessions: 'https://ogabassey.com/api/agentic/checkout_sessions',
      feeds: {
        agent_products: 'https://ogabassey.com/feeds/agent-products.jsonl',
        facebook_catalog_xml: 'https://ogabassey.com/feeds/facebook.xml',
        google_merchant_xml: 'https://ogabassey.com/feeds/google-merchant.xml',
      },
      llms: 'https://ogabassey.com/llms.txt',
      llms_full: 'https://ogabassey.com/llms-full.txt',
      order: 'https://ogabassey.com/api/agentic/orders/{order_id}',
      product_api: 'https://ogabassey.com/api/storefront/ogabassey/products',
      product_feed: 'https://ogabassey.com/feeds/openai.jsonl',
      privacy_policy_url: 'https://ogabassey.com/privacy',
      return_policy_url: 'https://ogabassey.com/returns',
      shipping_policy_url: 'https://ogabassey.com/shipping',
      terms_of_service_url: 'https://ogabassey.com/terms',
      trust: 'https://ogabassey.com/agent-trust.json',
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

function buildAuth(
  overrides: Partial<NonNullable<AgentCommerceManifest['auth']>> = {}
): NonNullable<AgentCommerceManifest['auth']> {
  return {
    ...buildManifest().auth,
    ...overrides,
  } as NonNullable<AgentCommerceManifest['auth']>;
}

describe('buildAcpDiscoveryProfile', () => {
  it('builds the public ACP discovery response from the agent commerce manifest', () => {
    const profile = buildAcpDiscoveryProfile(buildManifest());

    expect(profile).toMatchObject({
      protocol: {
        name: 'acp',
        version: '2026-04-30',
        supported_versions: ['2026-01-01', '2026-04-17', '2026-04-30'],
        documentation_url:
          'https://ogabassey.com/.well-known/agent-native-commerce',
      },
      api_base_url: 'https://ogabassey.com/api/agentic',
      transports: ['rest'],
      capabilities: {
        services: ['checkout', 'orders'],
        supported_currencies: ['NGN'],
        supported_locales: ['en-NG'],
      },
    });
  });

  it('omits checkout and order services when required manifest links are absent', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        capabilities: ['catalog.read'],
        links: {
          ...buildManifest().links,
          checkout_sessions: undefined,
          order: undefined,
        },
        payment_methods: [],
      })
    );

    expect(profile.capabilities.services).toEqual([]);
    expect(profile.capabilities.supported_currencies).toEqual([]);
  });

  it('omits services when required link fields are empty strings', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        capabilities: ['catalog.read'],
        links: {
          ...buildManifest().links,
          checkout_sessions: '',
          order: '',
        },
      })
    );

    expect(profile.capabilities.services).toEqual([]);
    expect(profile.capabilities.supported_currencies).toEqual(['NGN']);
  });

  it('omits checkout service when the checkout capability set is partial', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        capabilities: [
          'catalog.read',
          'order.read',
          'checkout.session.create',
          'checkout.session.read',
        ],
      })
    );

    expect(profile.capabilities.services).toEqual(['orders']);
    expect(profile.capabilities.supported_currencies).toEqual(['NGN']);
  });

  it('omits checkout service when checkout links are partial', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        capabilities: [
          'catalog.read',
          'checkout.session.create',
          'checkout.session.read',
          'checkout.session.update',
          'checkout.session.complete',
          'checkout.session.cancel',
        ],
        links: {
          ...buildManifest().links,
          checkout_session_cancel: '',
          order: undefined,
        },
      })
    );

    expect(profile.capabilities.services).toEqual([]);
    expect(profile.capabilities.supported_currencies).toEqual(['NGN']);
  });

  it('deduplicates and sorts supported protocol versions', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        auth: {
          ...buildAuth(),
          supported_api_versions: [
            '2026-04-30',
            '2026-04-17',
            ' ',
            '2026-01-01',
            '2026-04-30',
          ],
        },
      })
    );

    expect(profile.protocol.supported_versions).toEqual([
      '2026-01-01',
      '2026-04-17',
      '2026-04-30',
    ]);
    expect(profile.protocol.version).toBe('2026-04-30');
  });

  it('falls back to the current schema version when no manifest versions are usable', () => {
    const profile = buildAcpDiscoveryProfile(
      buildManifest({
        auth: {
          ...buildAuth(),
          supported_api_versions: ['', '   '],
        },
        schema_version: '' as AgentCommerceManifest['schema_version'],
      })
    );

    expect(profile.protocol.supported_versions).toEqual(['2026-04-30']);
    expect(profile.protocol.version).toBe('2026-04-30');
  });
});
