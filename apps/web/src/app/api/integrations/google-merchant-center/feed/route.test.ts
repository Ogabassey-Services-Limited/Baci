import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFrom = vi.fn();
const mockResolveFeedMerchant = vi.fn();

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/feed-identifier', () => {
  class _MerchantNotFoundError extends Error {
    constructor(identifier: string) {
      super(`Merchant not found: ${identifier}`);
      this.name = 'MerchantNotFoundError';
    }
  }

  return {
    MerchantNotFoundError: _MerchantNotFoundError,
    resolveFeedMerchant: (...args: unknown[]) =>
      mockResolveFeedMerchant(...args),
  };
});

import { MerchantNotFoundError } from '@/lib/feed-identifier';

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

function mockDomainLookup(result: { data: unknown; error: unknown }) {
  const mockStatusEq = vi.fn(() => ({
    maybeSingle: () => Promise.resolve(result),
  }));
  const mockDomainEq = vi.fn(() => ({
    eq: mockStatusEq,
  }));

  mockFrom.mockReturnValue({
    select: () => ({
      eq: mockDomainEq,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  mockResolveFeedMerchant.mockResolvedValue({
    id: 'merchant-1',
    slug: 'ogabassey',
  });
});

describe('GET /api/integrations/google-merchant-center/feed', () => {
  it('redirects custom-domain requests to the canonical public feed URL', async () => {
    mockDomainLookup({
      data: { merchant_id: 'merchant-1' },
      error: null,
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://ogabassey.com/api/integrations/google-merchant-center/feed',
        { host: 'ogabassey.com' }
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey'
    );
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith('merchant-1', false);
  });

  it('redirects managed subdomain requests without querying domains', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://ogabassey.usebaci.com/api/integrations/google-merchant-center/feed',
        { host: 'ogabassey.usebaci.com' }
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://ogabassey.usebaci.com/api/feed/google-merchant?merchant_slug=ogabassey'
    );
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockResolveFeedMerchant).not.toHaveBeenCalled();
  });

  it('prefers x-forwarded-host and strips ports', async () => {
    mockDomainLookup({
      data: { merchant_id: 'merchant-1' },
      error: null,
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://internal.baci.app/api/integrations/google-merchant-center/feed',
        {
          host: 'internal.baci.app',
          'x-forwarded-host': 'ogabassey.com:443',
        }
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey'
    );
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith('merchant-1', false);
  });

  it('respects x-forwarded-proto when building the redirect URL', async () => {
    mockDomainLookup({
      data: { merchant_id: 'merchant-1' },
      error: null,
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://internal.baci.app/api/integrations/google-merchant-center/feed',
        {
          host: 'internal.baci.app',
          'x-forwarded-host': 'ogabassey.com',
          'x-forwarded-proto': 'http',
        }
      )
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'http://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey'
    );
  });

  it('returns 404 when the host cannot be mapped to a merchant', async () => {
    mockDomainLookup({ data: null, error: null });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://unknown-store.com/api/integrations/google-merchant-center/feed',
        { host: 'unknown-store.com' }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 500 when domain lookup fails', async () => {
    mockDomainLookup({
      data: null,
      error: { message: 'db offline' },
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://ogabassey.com/api/integrations/google-merchant-center/feed',
        { host: 'ogabassey.com' }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to resolve merchant for legacy feed URL');
  });

  it('returns 404 when merchant resolution fails after a domain lookup', async () => {
    mockDomainLookup({
      data: { merchant_id: 'merchant-1' },
      error: null,
    });
    mockResolveFeedMerchant.mockRejectedValue(
      new MerchantNotFoundError('merchant-1')
    );
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        'https://ogabassey.com/api/integrations/google-merchant-center/feed',
        { host: 'ogabassey.com' }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });
});
