import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  mockGetMerchantByIdentifier.mockResolvedValue({
    id: 'merchant-1',
    slug: 'ogabassey',
    business_name: 'Ogabassey',
    custom_domain: 'ogabassey.com',
  });
});

describe('GET /agent-commerce.json', () => {
  it('returns Ogabassey agent commerce capabilities for the custom domain', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/agent-commerce.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schema_version).toBe('2026-04-28');
    expect(body.store).toMatchObject({
      slug: 'ogabassey',
      name: 'Ogabassey',
      canonical_origin: 'https://ogabassey.com',
    });
    expect(body.capabilities).toEqual(['catalog.read']);
    expect(body.auth).toBeNull();
    expect(body.links.product_feed).toBe(
      'https://ogabassey.com/api/feed/openai?merchant_slug=ogabassey'
    );
    expect(body.links.feeds).toMatchObject({
      agent_products:
        'https://ogabassey.com/api/feed/openai?merchant_slug=ogabassey&format=current',
    });
    expect(body.links.checkout_sessions).toBeUndefined();
    expect(body.links).toMatchObject({
      privacy_policy_url: 'https://ogabassey.com/privacy',
      return_policy_url: 'https://ogabassey.com/returns',
      shipping_policy_url: 'https://ogabassey.com/shipping',
      terms_of_service_url: 'https://ogabassey.com/terms',
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
  });

  it('returns 404 when the request host does not resolve to a storefront', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/agent-commerce.json', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent commerce manifest is only available on storefront hosts'
    );
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('does not trust spoofable storefront headers on the platform host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/agent-commerce.json', {
        headers: {
          host: 'usebaci.com',
          'x-custom-domain': 'ogabassey.com',
          'x-merchant-slug': 'ogabassey',
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent commerce manifest is only available on storefront hosts'
    );
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('treats IPv6 localhost with a port as a non-storefront host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('http://[::1]:3000/agent-commerce.json', {
        headers: { host: '[::1]:3000' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent commerce manifest is only available on storefront hosts'
    );
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 404 when the storefront host has no merchant record', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://missing.example.com/agent-commerce.json', {
        headers: { host: 'missing.example.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'Agent commerce manifest is only available on storefront hosts'
    );
  });

  it('returns 400 when the resolved storefront identifier is invalid', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://usebaci.com/agent-commerce.json', {
        headers: { host: '<script>' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid storefront host');
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });

  it('returns 500 when merchant lookup fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetMerchantByIdentifier.mockRejectedValue(new Error('lookup failed'));

    try {
      const { GET } = await import('./route');
      const response = await GET(
        new Request('https://ogabassey.com/agent-commerce.json', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to build agent commerce manifest');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
