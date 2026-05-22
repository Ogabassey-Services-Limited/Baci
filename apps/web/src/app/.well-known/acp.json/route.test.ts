// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

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

function stubMerchant(overrides: Record<string, unknown> = {}) {
  mockGetMerchantByIdentifier.mockResolvedValue({
    business_name: 'Ogabassey',
    custom_domain: 'ogabassey.com',
    id: 'merchant-1',
    paystack_subaccount_code: 'ACCT_TESTMOCK1234567',
    slug: 'ogabassey',
    ...overrides,
  });
}

describe('GET /.well-known/acp.json', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    stubBaseEnv();
    stubMerchant();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('publishes the ACP discovery document for storefront hosts', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/.well-known/acp.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      protocol: {
        name: 'acp',
        version: '2026-04-30',
        supported_versions: ['2026-01-01', '2026-04-30'],
      },
      api_base_url: 'https://ogabassey.com/api/agentic',
      transports: ['rest'],
      capabilities: {
        services: ['checkout', 'orders'],
        supported_currencies: ['NGN'],
        supported_locales: ['en-NG'],
      },
    });
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
  });

  it('returns 404 on the platform host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/.well-known/acp.json', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'ACP discovery is only available on storefront hosts'
    );
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant is not enabled for ACP', async () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', '');

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/.well-known/acp.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('ACP discovery is not enabled for this storefront');
  });

  it('returns 500 when merchant lookup fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const lookupError = new Error('db fail');
    mockGetMerchantByIdentifier.mockRejectedValue(lookupError);

    try {
      const { GET } = await import('./route');
      const response = await GET(
        new Request('https://ogabassey.com/.well-known/acp.json', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to build ACP discovery');
      expect(errorSpy).toHaveBeenCalledWith(
        'ACP_DISCOVERY_ERROR:',
        lookupError
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
