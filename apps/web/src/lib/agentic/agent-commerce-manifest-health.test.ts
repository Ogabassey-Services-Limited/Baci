import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildAgentCommerceManifestHealthUrl,
  checkAgentCommerceManifestHealth,
  validateAgentCommerceManifestHealth,
} from './agent-commerce-manifest-health';

function createHealthyManifest() {
  return {
    auth: {
      supported_api_versions: ['2026-04-30'],
      type: 'bearer_hmac',
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
      order: 'https://ogabassey.com/api/agentic/orders/{order_id}',
      product_api: 'https://ogabassey.com/api/storefront/ogabassey/products',
      product_feed: 'https://ogabassey.com/feeds/openai.jsonl',
      trust: 'https://ogabassey.com/agent-trust.json',
    },
    payment_methods: ['paystack_bank_transfer'],
    schema_version: '2026-04-30',
    store: {
      canonical_origin: 'https://ogabassey.com',
      name: 'Ogabassey',
      slug: 'ogabassey',
    },
  };
}

function createManifestResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

describe('buildAgentCommerceManifestHealthUrl', () => {
  it('uses the merchant custom domain when one is configured', () => {
    expect(
      buildAgentCommerceManifestHealthUrl({
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
      })
    ).toBe('https://ogabassey.com/agent-commerce.json');
  });

  it('falls back to the merchant subdomain when no custom domain is configured', () => {
    expect(
      buildAgentCommerceManifestHealthUrl({
        custom_domain: null,
        slug: 'ogabassey',
      })
    ).toBe('https://ogabassey.usebaci.com/agent-commerce.json');
  });
});

describe('validateAgentCommerceManifestHealth', () => {
  it('passes a complete agent-commerce manifest contract', () => {
    expect(
      validateAgentCommerceManifestHealth({
        expectedOrigin: 'https://ogabassey.com',
        expectedSlug: 'ogabassey',
        manifest: createHealthyManifest(),
        url: 'https://ogabassey.com/agent-commerce.json',
      })
    ).toMatchObject({
      issue_count: 0,
      status: 'ok',
    });
  });

  it('flags partial checkout capability advertisement as drift', () => {
    const result = validateAgentCommerceManifestHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      manifest: {
        ...createHealthyManifest(),
        auth: null,
        capabilities: ['catalog.read', 'checkout.session.create'],
        payment_methods: [],
      },
      url: 'https://ogabassey.com/agent-commerce.json',
    });

    expect(result.status).toBe('attention');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'manifest_contract_drift',
          message: 'Manifest advertises a partial checkout capability set.',
        }),
      ])
    );
  });

  it.each([
    {
      expectedMessage: 'Manifest schema version does not match runtime.',
      manifest: { ...createHealthyManifest(), schema_version: '2026-01-01' },
    },
    {
      expectedMessage: 'Manifest store metadata is missing.',
      manifest: { ...createHealthyManifest(), store: null },
    },
    {
      expectedMessage: 'Manifest link trust is missing.',
      manifest: {
        ...createHealthyManifest(),
        links: { ...createHealthyManifest().links, trust: '' },
      },
    },
    {
      expectedMessage: 'Manifest must advertise catalog.read.',
      manifest: { ...createHealthyManifest(), capabilities: ['order.read'] },
    },
    {
      expectedMessage: 'Order read requires manifest auth.',
      manifest: { ...createHealthyManifest(), auth: null },
    },
    {
      expectedMessage: 'Manifest response must be a JSON object.',
      manifest: null,
    },
  ])('flags $expectedMessage', ({ expectedMessage, manifest }) => {
    const result = validateAgentCommerceManifestHealth({
      expectedOrigin: 'https://ogabassey.com',
      expectedSlug: 'ogabassey',
      manifest,
      url: 'https://ogabassey.com/agent-commerce.json',
    });

    expect(result.status).toBe('attention');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'manifest_contract_drift',
          message: expectedMessage,
        }),
      ])
    );
  });
});

describe('checkAgentCommerceManifestHealth', () => {
  it('fetches the public manifest without cache and validates the contract', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createManifestResponse(createHealthyManifest()));

    const result = await checkAgentCommerceManifestHealth(
      {
        custom_domain: 'ogabassey.com',
        slug: 'ogabassey',
      },
      fetcher
    );

    expect(result.status).toBe('ok');
    expect(fetcher).toHaveBeenCalledWith(
      'https://ogabassey.com/agent-commerce.json',
      {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('returns attention when the manifest endpoint is unavailable', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(createManifestResponse({ error: 'missing' }, 404));

    await expect(
      checkAgentCommerceManifestHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'manifest_unavailable',
          message: 'Manifest returned HTTP 404.',
        },
      ],
      status: 'attention',
    });
  });

  it('returns attention when the manifest response cannot be parsed', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not-json', {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    );

    await expect(
      checkAgentCommerceManifestHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'manifest_invalid_json',
          message: 'Manifest response is not valid JSON.',
        },
      ],
      status: 'attention',
    });
  });

  it('returns attention when the manifest request fails', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network unavailable'));

    await expect(
      checkAgentCommerceManifestHealth(
        {
          custom_domain: 'ogabassey.com',
          slug: 'ogabassey',
        },
        fetcher
      )
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'manifest_unavailable',
          message: 'Manifest could not be fetched.',
        },
      ],
      status: 'attention',
    });
  });
});
