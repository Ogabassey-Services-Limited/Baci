// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

function stubBaseEnv() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.example.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', '');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', '');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', '');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS', '');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', '');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS', '');
  vi.stubEnv('PAYSTACK_SECRET_KEY', '');
  vi.stubEnv('SUPABASE_JWT_SECRET', '');
}

function stubAgenticCheckoutEnv() {
  vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'another-store');
  vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
  vi.stubEnv('OPENAI_AGENTIC_CONFIRMATION_KEY', 'confirmation-key');
  vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', 'signing-key');
  vi.stubEnv('PAYSTACK_SECRET_KEY', 'paystack-secret');
  vi.stubEnv('SUPABASE_JWT_SECRET', 'supabase-jwt-secret');
}

describe('GET /agent-commerce.json checkout capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not advertise checkout on non-configured storefront merchants', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
      slug: 'another-store',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://another.example/agent-commerce.json', {
        headers: { host: 'another.example' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities).toEqual(['catalog.read']);
    expect(body.auth).toBeNull();
    expect(body.links.checkout_sessions).toBeUndefined();
    expect(body.links.checkout_session_complete).toBeUndefined();
    expect(body.links.product_api).toBe(
      'https://another.example/api/storefront/another-store/products'
    );
  });

  it('advertises checkout for the configured agentic merchant slug', async () => {
    stubAgenticCheckoutEnv();
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
      slug: 'another-store',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://another.example/agent-commerce.json', {
        headers: { host: 'another.example' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities).toContain('checkout.session.complete');
    expect(body.auth).toMatchObject({
      type: 'bearer_hmac',
      request_signing: {
        algorithm: 'hmac-sha256',
        required_headers: [
          'api-version',
          'authorization',
          'request-id',
          'signature',
          'timestamp',
        ],
        mutation_required_headers: [
          'api-version',
          'authorization',
          'request-id',
          'signature',
          'timestamp',
          'idempotency-key',
        ],
      },
    });
    expect(body.links.checkout_sessions).toBe(
      'https://another.example/api/agentic/checkout_sessions'
    );
    expect(body.links.checkout_session_complete).toBe(
      'https://another.example/api/agentic/checkout_sessions/{session_id}/complete'
    );
  });

  it('does not advertise checkout when the merchant subaccount is missing', async () => {
    stubAgenticCheckoutEnv();
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: null,
      slug: 'another-store',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://another.example/agent-commerce.json', {
        headers: { host: 'another.example' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities).toEqual(['catalog.read']);
    expect(body.auth).toBeNull();
    expect(body.links.checkout_sessions).toBeUndefined();
    expect(body.links.checkout_session_complete).toBeUndefined();
  });

  // Only discovery-safe catalog access is advertised when agent API env exists
  // but signing, confirmation, and payment runtime secrets are absent.
  it('does not advertise checkout when runtime secrets are incomplete', async () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'another-store');
    vi.stubEnv('OPENAI_AGENTIC_API_KEY', 'agent-api-key');
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
      slug: 'another-store',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://another.example/agent-commerce.json', {
        headers: { host: 'another.example' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities).toEqual(['catalog.read']);
    expect(body.auth).toBeNull();
    expect(body.links.checkout_sessions).toBeUndefined();
    expect(body.links.checkout_session_complete).toBeUndefined();
  });
});
