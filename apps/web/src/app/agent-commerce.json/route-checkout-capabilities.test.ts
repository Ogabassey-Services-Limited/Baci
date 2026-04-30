import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

describe('GET /agent-commerce.json checkout capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not advertise checkout on non-configured storefront merchants', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: 'ACCT_test123',
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
    expect(body.links.product_api).toBe(
      'https://another.example/api/storefront/another-store/products'
    );
  });

  it('advertises checkout for the configured agentic merchant slug', async () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'another-store');
    mockGetMerchantByIdentifier.mockResolvedValue({
      business_name: 'Another Store',
      custom_domain: 'another.example',
      id: 'merchant-2',
      paystack_subaccount_code: 'ACCT_test123',
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
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'another-store');
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
  });
});
