// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'confirmation-key');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', 'signing-key');
  vi.stubEnv('SUPABASE_JWT_SECRET', 'supabase-jwt-secret');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-secret');
}

describe('agent commerce manifest builder', () => {
  beforeEach(() => {
    vi.resetModules();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds concrete and templated URLs without slash drift', async () => {
    const { buildTemplateUrl, buildUrl } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    expect(buildUrl('https://ogabassey.com', '/feeds/openai.jsonl')).toBe(
      'https://ogabassey.com/feeds/openai.jsonl'
    );
    expect(buildUrl('https://ogabassey.com/', 'feeds/openai.jsonl')).toBe(
      'https://ogabassey.com/feeds/openai.jsonl'
    );
    expect(
      buildTemplateUrl(
        'https://ogabassey.com/',
        'api/agentic/checkout_sessions/{session_id}'
      )
    ).toBe('https://ogabassey.com/api/agentic/checkout_sessions/{session_id}');
  });

  it('builds checkout links and payment methods from merchant runtime config', async () => {
    const { buildAgentCommerceManifest } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    const manifest = buildAgentCommerceManifest(
      {
        business_name: 'Ogabassey',
        feature_settings: { pay_on_delivery_enabled: true },
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'ogabassey',
      },
      'https://ogabassey.com/'
    );

    expect(manifest.capabilities).toContain('checkout.session.complete');
    expect(manifest.payment_methods).toEqual([
      'paystack_bank_transfer',
      'pay_on_delivery',
    ]);
    expect(manifest.auth?.type).toBe('bearer_hmac');
    expect(manifest.links.checkout_session).toBe(
      'https://ogabassey.com/api/agentic/checkout_sessions/{session_id}'
    );
    expect(manifest.links.order).toBe(
      'https://ogabassey.com/api/agentic/orders/{order_id}'
    );
  });

  it('advertises only pay-on-delivery when Paystack is not configured', async () => {
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');

    const { buildAgentCommerceManifest } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    const manifest = buildAgentCommerceManifest(
      {
        business_name: 'Ogabassey',
        feature_settings: { pay_on_delivery_enabled: true },
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'ogabassey',
      },
      'https://ogabassey.com'
    );

    expect(manifest.capabilities).toContain('checkout.session.complete');
    expect(manifest.payment_methods).toEqual(['pay_on_delivery']);
  });

  it('keeps catalog-only discovery when the merchant slug is not configured', async () => {
    const { buildAgentCommerceManifest } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    const manifest = buildAgentCommerceManifest(
      {
        business_name: 'Another Store',
        feature_settings: { pay_on_delivery_enabled: true },
        paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
        slug: 'another-store',
      },
      'https://another.example'
    );

    expect(manifest.capabilities).toEqual(['catalog.read']);
    expect(manifest.payment_methods).toEqual([]);
    expect(manifest.auth).toBeNull();
    expect(manifest.links.checkout_sessions).toBeUndefined();
  });

  it('keeps catalog-only discovery when payment methods are unavailable', async () => {
    const { buildAgentCommerceManifest } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    const manifest = buildAgentCommerceManifest(
      {
        business_name: 'Ogabassey',
        feature_settings: { pay_on_delivery_enabled: false },
        paystack_subaccount_code: null,
        slug: 'ogabassey',
      },
      'https://ogabassey.com'
    );

    expect(manifest.capabilities).toEqual(['catalog.read']);
    expect(manifest.payment_methods).toEqual([]);
    expect(manifest.auth).toBeNull();
  });

  it('throws when the base URL cannot be used to build concrete links', async () => {
    const { buildAgentCommerceManifest } = await import(
      '@/lib/agentic/agent-commerce-manifest'
    );

    expect(() =>
      buildAgentCommerceManifest(
        {
          business_name: 'Ogabassey',
          feature_settings: undefined,
          paystack_subaccount_code: null,
          slug: 'ogabassey',
        },
        'not a url'
      )
    ).toThrow();
  });
});
