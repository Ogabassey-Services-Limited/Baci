import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();
const mockGenerateGoogleMerchantFeed = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock('./feed-builder', () => ({
  generateGoogleMerchantFeed: (...args: unknown[]) =>
    mockGenerateGoogleMerchantFeed(...args),
}));

type MerchantRecord = {
  id: string;
  business_name: string;
  country: string;
  payout_currency: string;
  slug: string;
};

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
  stock: number;
  updated_at: string;
};

let merchantResult: { data: MerchantRecord | null; error: unknown };
let domainResult: { data: { domain: string } | null; error: unknown };
let productsResult: { data: ProductRecord[]; error: unknown };
let manifestResult: { data: Record<string, unknown>[]; error: unknown };

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(merchantResult),
            }),
          }),
        };
      }

      if (table === 'domains') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve(domainResult),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve(productsResult),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'product_feed_images') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve(manifestResult),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

function makeRequest(path: string) {
  return new NextRequest(`https://example.com${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  merchantResult = {
    data: {
      id: 'merchant-1',
      business_name: 'Ogabassey',
      country: 'NG',
      payout_currency: 'NGN',
      slug: 'ogabassey',
    },
    error: null,
  };
  domainResult = {
    data: { domain: 'ogabassey.com' },
    error: null,
  };
  productsResult = {
    data: [
      {
        id: 'product-1',
        name: 'Phone',
        description: 'Good phone',
        slug: 'phone',
        price: 100,
        stock: 2,
        updated_at: '2026-03-17T00:00:00.000Z',
      },
    ],
    error: null,
  };
  manifestResult = {
    data: [
      {
        product_id: 'product-1',
        verified_url:
          'https://cdn.ogabassey.com/core-assets/products/phone.jpg',
        verified_format: 'jpeg',
        status: 'verified',
        is_primary: true,
        position: 0,
      },
    ],
    error: null,
  };
  mockCreateClient.mockReturnValue(createMockSupabase());
  mockGenerateGoogleMerchantFeed.mockReturnValue('<rss />');
});

describe('GET /api/feed/google-merchant', () => {
  it('returns 400 when merchant identifier is missing', async () => {
    const { GET } = await import('./route');

    const response = await GET(makeRequest('/api/feed/google-merchant'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'merchant_id or merchant_slug parameter is required'
    );
  });

  it('uses the primary domain from domains for canonical product links', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
      productsResult.data,
      expect.objectContaining({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      }),
      'https://ogabassey.com',
      expect.any(Object)
    );
  });

  it('returns 404 when merchant is not found', async () => {
    merchantResult = {
      data: null,
      error: null,
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when fetching the primary domain fails', async () => {
    domainResult = {
      data: null,
      error: { message: 'boom' },
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when fetching products fails', async () => {
    productsResult = {
      data: [],
      error: { message: 'boom' },
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when fetching the image manifest fails', async () => {
    manifestResult = {
      data: [],
      error: { message: 'boom' },
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('passes an empty product list through to the feed builder', async () => {
    productsResult = {
      data: [],
      error: null,
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
      [],
      expect.any(Object),
      'https://ogabassey.com',
      expect.any(Object)
    );
  });
});
