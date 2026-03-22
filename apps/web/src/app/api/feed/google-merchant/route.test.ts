import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();
const mockGenerateGoogleMerchantFeed = vi.fn();
const mockRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
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
  gmc_variants_enabled?: boolean;
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
let variantRpcResult: { data: unknown[] | null; error: unknown };
let specsResult: { data: unknown[] | null; error: unknown };
let specsQueryCalls: string[][];
let specsQueryResults: Array<{ data: unknown[] | null; error: unknown }>;

function createMockSupabase() {
  return {
    rpc: (...args: unknown[]) => mockRpc(...args),
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

      if (table === 'product_key_specs') {
        return {
          select: () => ({
            in: (_column: string, ids: string[]) => {
              specsQueryCalls.push(ids);
              return Promise.resolve(specsQueryResults.shift() ?? specsResult);
            },
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
  variantRpcResult = { data: [], error: null };
  specsResult = { data: [], error: null };
  specsQueryCalls = [];
  specsQueryResults = [];
  mockCreateClient.mockReturnValue(createMockSupabase());
  mockRpc.mockImplementation(() => Promise.resolve(variantRpcResult));
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

  it('returns 200 when using merchant_id parameter', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        '/api/feed/google-merchant?merchant_id=00000000-0000-4000-8000-000000000001'
      )
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

  it('returns 500 when variant RPC fails with gmc_variants_enabled', async () => {
    merchantResult = {
      data: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        country: 'NG',
        payout_currency: 'NGN',
        slug: 'ogabassey',
        gmc_variants_enabled: true,
      },
      error: null,
    };
    variantRpcResult = { data: null, error: { message: 'rpc failed' } };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('passes mapped variants to the feed builder when gmc_variants_enabled is true', async () => {
    merchantResult = {
      data: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        country: 'NG',
        payout_currency: 'NGN',
        slug: 'ogabassey',
        gmc_variants_enabled: true,
      },
      error: null,
    };
    variantRpcResult = {
      data: [
        {
          id: 'variant-1',
          product_id: 'product-1',
          sku: 'IP16-128-BLUE',
          attributes: { color: 'Blue', storage: '128GB' },
          price_override: 150,
          stock_quantity: 3,
        },
      ],
      error: null,
    };
    specsResult = {
      data: [{ product_id: 'product-1', ram_gb: 8 }],
      error: null,
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith('get_storefront_product_variants', {
      p_product_ids: ['product-1'],
    });
    expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'product-1',
          key_specs: { ram_gb: 8 },
          variants: [
            expect.objectContaining({
              id: 'variant-1',
              sku: 'IP16-128-BLUE',
              attributes: { color: 'Blue', storage: '128GB' },
              price_override: 150,
              stock_quantity: 3,
            }),
          ],
        }),
      ],
      expect.any(Object),
      'https://ogabassey.com',
      expect.any(Object)
    );
  });

  it('returns 500 when key_specs query fails with gmc_variants_enabled', async () => {
    merchantResult = {
      data: {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        country: 'NG',
        payout_currency: 'NGN',
        slug: 'ogabassey',
        gmc_variants_enabled: true,
      },
      error: null,
    };
    specsResult = { data: null, error: { message: 'specs query failed' } };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('fetches key_specs even when gmc_variants_enabled is disabled', async () => {
    specsResult = {
      data: [{ product_id: 'product-1', ram_gb: 8 }],
      error: null,
    };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(specsQueryCalls).toEqual([['product-1']]);
    expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'product-1',
          key_specs: { ram_gb: 8 },
        }),
      ],
      expect.any(Object),
      'https://ogabassey.com',
      expect.any(Object)
    );
  });

  it('returns 500 when key_specs query fails without gmc_variants_enabled', async () => {
    specsResult = { data: null, error: { message: 'specs query failed' } };
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
    expect(mockGenerateGoogleMerchantFeed).not.toHaveBeenCalled();
  });

  it('batches product_key_specs lookups for large catalogs', async () => {
    productsResult = {
      data: Array.from({ length: 450 }, (_, index) => ({
        id: `product-${index + 1}`,
        name: `Phone ${index + 1}`,
        description: 'Good phone',
        slug: `phone-${index + 1}`,
        price: 100,
        stock: 2,
        updated_at: '2026-03-17T00:00:00.000Z',
      })),
      error: null,
    };
    specsQueryResults = [
      {
        data: [{ product_id: 'product-1', ram_gb: 8 }],
        error: null,
      },
      {
        data: [{ product_id: 'product-201', battery_mah: 5000 }],
        error: null,
      },
      {
        data: [{ product_id: 'product-401', storage_gb: 256 }],
        error: null,
      },
    ];
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/google-merchant?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(specsQueryCalls.map((ids) => ids.length)).toEqual([200, 200, 50]);
    expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'product-1',
          key_specs: { ram_gb: 8 },
        }),
        expect.objectContaining({
          id: 'product-201',
          key_specs: { battery_mah: 5000 },
        }),
        expect.objectContaining({
          id: 'product-401',
          key_specs: { storage_gb: 256 },
        }),
      ]),
      expect.any(Object),
      'https://ogabassey.com',
      expect.any(Object)
    );
  });
});
