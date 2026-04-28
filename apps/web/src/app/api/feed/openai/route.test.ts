import { gunzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveFeedMerchant = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const mockGetMerchantByIdentifier = vi.fn();

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

vi.mock('./feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    mockGetCachedOpenAIFeedData(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

vi.mock('@/lib/cache-headers', () => ({
  CACHE_HEADERS: {
    LONG: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  },
}));

import { MerchantNotFoundError } from '@/lib/feed-identifier';

interface ProductFixture {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean;
  category?: string;
  category_slug?: string;
  canonical_url?: string;
  categories?: { name?: string | null; slug?: string | null } | null;
  images?: string[];
  updated_at: string;
  variants?: Array<{
    id: string;
    attributes: Record<string, string>;
    price_override?: number;
    stock_quantity?: number;
    sku?: string;
    primary_image?: string;
  }>;
}

function makeRequest(path: string) {
  return new NextRequest(`https://ogabassey.usebaci.com${path}`, {
    headers: { host: 'ogabassey.usebaci.com' },
  });
}

function simpleProduct(
  overrides: Partial<ProductFixture> = {}
): ProductFixture {
  return {
    id: 'prod-1',
    name: 'Test Phone',
    description: 'A phone',
    slug: 'test-phone',
    price: 50000,
    stock: 5,
    images: ['https://cdn.example.com/phone.jpg'],
    updated_at: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  mockResolveFeedMerchant.mockResolvedValue({
    id: 'merchant-1',
    business_name: 'Ogabassey',
    country: 'NG',
    payout_currency: 'NGN',
    slug: 'ogabassey',
  });
  mockGetMerchantByIdentifier.mockResolvedValue({
    id: 'merchant-1',
    business_name: 'Ogabassey',
    country: 'NG',
    payout_currency: 'NGN',
    slug: 'ogabassey',
    custom_domain: 'ogabassey.com',
  });

  mockGetCachedOpenAIFeedData.mockResolvedValue({
    products: [simpleProduct()],
  });
});

describe('GET /api/feed/openai', () => {
  it('returns 400 when merchant identifier is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(makeRequest('/api/feed/openai'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'merchant_id or merchant_slug parameter is required'
    );
  });

  it('returns 400 when both merchant_id and merchant_slug are provided', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest(
        '/api/feed/openai?merchant_id=00000000-0000-4000-8000-000000000001&merchant_slug=ogabassey'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'Provide exactly one of merchant_id or merchant_slug, not both'
    );
  });

  it('returns 200 with JSONL for valid slug', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson'
    );

    const text = await response.text();
    const parsed = JSON.parse(text);
    expect(parsed.title).toBe('Test Phone');
    expect(parsed.merchant_name).toBe('Ogabassey');
    expect(parsed.privacy_policy_url).toBe(
      'https://ogabassey.usebaci.com/privacy'
    );
    expect(parsed.return_policy_url).toBe(
      'https://ogabassey.usebaci.com/returns'
    );
    expect(parsed.terms_of_service_url).toBe(
      'https://ogabassey.usebaci.com/terms'
    );
  });

  it('passes resolved merchant UUID (not slug) to cached data fetcher', async () => {
    const { GET } = await import('./route');
    await GET(makeRequest('/api/feed/openai?merchant_slug=ogabassey'));

    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalledWith('ogabassey');
  });

  it('returns 200 with JSONL for valid merchant_id', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest(
        '/api/feed/openai?merchant_id=00000000-0000-4000-8000-000000000001'
      )
    );

    expect(response.status).toBe(200);
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      false
    );
  });

  it('returns 404 when merchant is not found', async () => {
    mockResolveFeedMerchant.mockRejectedValue(
      new MerchantNotFoundError('nonexistent')
    );
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=nonexistent')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 500 when feed data fetch fails', async () => {
    mockGetCachedOpenAIFeedData.mockRejectedValue(
      new Error('Failed to fetch products')
    );
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
  });

  it('returns gzipped content when format=jsonl', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=jsonl')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/gzip');

    const buffer = Buffer.from(await response.arrayBuffer());
    const decompressed = gunzipSync(buffer).toString('utf-8');
    const parsed = JSON.parse(decompressed);
    expect(parsed.title).toBe('Test Phone');
  });

  it('rejects merchant_slug requests from mismatched storefront hosts', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-other',
      slug: 'other-store',
      business_name: 'Other Store',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'https://other-store.usebaci.com/api/feed/openai?merchant_slug=ogabassey',
        { headers: { host: 'other-store.usebaci.com' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Merchant slug does not match storefront host');
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
  });

  it('does not trust spoofed storefront headers when verifying feed hosts', async () => {
    mockGetMerchantByIdentifier.mockImplementation((identifier) => {
      if (identifier === 'other-store') {
        return {
          id: 'merchant-other',
          slug: 'other-store',
          business_name: 'Other Store',
        };
      }

      return {
        id: 'merchant-1',
        business_name: 'Ogabassey',
        country: 'NG',
        payout_currency: 'NGN',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      };
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'https://other-store.usebaci.com/api/feed/openai?merchant_slug=ogabassey&format=current',
        {
          headers: {
            host: 'other-store.usebaci.com',
            'x-custom-domain': 'ogabassey.com',
            'x-merchant-slug': 'ogabassey',
          },
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Merchant slug does not match storefront host');
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('other-store');
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalledWith(
      'ogabassey.com'
    );
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
  });

  it('uses the canonical merchant URL when the request is not storefront scoped', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/feed/openai?merchant_slug=ogabassey&format=current',
        { headers: { host: 'usebaci.com' } }
      )
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
    expect(parsed.url).toBe(
      'https://ogabassey.usebaci.com/products/test-phone'
    );
  });

  it('treats IPv6 localhost with a port as not storefront scoped', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'http://[::1]:3000/api/feed/openai?merchant_slug=ogabassey&format=current',
        { headers: { host: '[::1]:3000' } }
      )
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
    expect(parsed.url).toBe(
      'https://ogabassey.usebaci.com/products/test-phone'
    );
  });

  it('rejects storefront scoped requests when the host cannot be resolved', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'https://missing.usebaci.com/api/feed/openai?merchant_slug=ogabassey&format=current',
        { headers: { host: 'missing.usebaci.com' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Merchant slug does not match storefront host');
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
  });

  it('emits current structured product objects when format=current', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          id: 'product-1',
          name: 'Riversong Motive 5T Smart Watch',
          slug: 'riversong-motive-5t-smart-watch',
          category: 'Smartwatches',
          categories: { name: 'Smartwatches', slug: 'smartwatches' },
          price: 30600,
          stock: 0,
          manage_stock: false,
        }),
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'https://ogabassey.com/api/feed/openai?merchant_slug=ogabassey&format=current',
        { headers: { host: 'ogabassey.com' } }
      )
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(parsed).toMatchObject({
      id: 'product-1',
      title: 'Riversong Motive 5T Smart Watch',
      url: 'https://ogabassey.com/smartwatches/riversong-motive-5t-smart-watch',
    });
    expect(parsed.variants[0]).toMatchObject({
      id: 'product-1',
      title: 'Riversong Motive 5T Smart Watch',
      price: { amount: 30600, currency: 'NGN' },
      availability: { available: true, status: 'in_stock' },
    });
  });

  it('emits non-purchasable tracked availability in current feed', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          stock: 0,
          stock_quantity: 0,
          manage_stock: true,
        }),
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(parsed.variants[0].availability).toEqual({
      available: false,
      status: 'out_of_stock',
      quantity: 0,
    });
  });

  it('emits current feed variants from product variants', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          manage_stock: true,
          compare_at_price: 60000,
          category: 'Laptops',
          variants: [
            {
              id: 'variant-red',
              sku: 'SKU-RED',
              attributes: { color: 'Red', storage: '256GB' },
              price_override: 55000,
              stock_quantity: 2,
            },
            {
              id: 'variant-blue',
              sku: 'SKU-BLUE',
              attributes: { color: 'Blue' },
              price_override: 53000,
              stock_quantity: 0,
            },
          ],
        }),
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(parsed.variants).toEqual([
      expect.objectContaining({
        id: 'SKU-RED',
        title: 'Test Phone - Red - 256GB',
        price: { amount: 55000, currency: 'NGN' },
        list_price: { amount: 60000, currency: 'NGN' },
        availability: {
          available: true,
          status: 'in_stock',
          quantity: 2,
        },
      }),
      expect.objectContaining({
        id: 'SKU-BLUE',
        title: 'Test Phone - Blue',
        price: { amount: 53000, currency: 'NGN' },
        list_price: { amount: 60000, currency: 'NGN' },
        availability: {
          available: false,
          status: 'out_of_stock',
          quantity: 0,
        },
      }),
    ]);
  });

  it('skips simple current feed products with non-positive prices', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [simpleProduct({ price: 0 })],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );

    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe('');
  });

  it('skips simple current feed products with negative prices', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [simpleProduct({ price: -1 })],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );

    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe('');
  });

  it('skips current feed variants with non-positive resolved prices', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          price: 60000,
          manage_stock: true,
          variants: [
            {
              id: 'variant-free',
              sku: 'SKU-FREE',
              attributes: { color: 'Free' },
              price_override: 0,
              stock_quantity: 2,
            },
            {
              id: 'variant-paid',
              sku: 'SKU-PAID',
              attributes: { color: 'Paid' },
              price_override: 12000,
              stock_quantity: 4,
            },
          ],
        }),
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );
    const line = (await response.text()).trim().split('\n')[0];
    const parsed = JSON.parse(line);

    expect(response.status).toBe(200);
    expect(parsed.variants).toEqual([
      expect.objectContaining({
        id: 'SKU-PAID',
        price: { amount: 12000, currency: 'NGN' },
      }),
    ]);
  });

  it('skips current feed products when all variants have non-positive resolved prices', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          price: 60000,
          variants: [
            {
              id: 'variant-free',
              sku: 'SKU-FREE',
              attributes: { color: 'Free' },
              price_override: 0,
              stock_quantity: 2,
            },
            {
              id: 'variant-negative',
              sku: 'SKU-NEGATIVE',
              attributes: { color: 'Negative' },
              price_override: -1,
              stock_quantity: 2,
            },
          ],
        }),
      ],
    });

    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey&format=current')
    );

    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe('');
  });
});

describe('GET /api/feed/openai — stock and manage_stock', () => {
  it('emits in_stock with quantity 9999 when manage_stock is false', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [simpleProduct({ stock: 0, manage_stock: false })],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(parsed.availability).toBe('in_stock');
    expect(parsed.quantity).toBe(9999);
  });

  it('uses stock_quantity over legacy stock when both are present', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [simpleProduct({ stock: 0, stock_quantity: 42 })],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(parsed.availability).toBe('in_stock');
    expect(parsed.quantity).toBe(42);
  });

  it('emits out_of_stock when stock is 0 and manage_stock is not false', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          stock: 0,
          stock_quantity: undefined,
          manage_stock: undefined,
        }),
      ],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(parsed.availability).toBe('out_of_stock');
    expect(parsed.quantity).toBe(0);
  });

  it('emits unlimited quantity for variants when manage_stock is false', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          manage_stock: false,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Red' },
              stock_quantity: 0,
              sku: 'SKU-RED',
            },
          ],
        }),
      ],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(parsed.quantity).toBe(9999);
    expect(parsed.availability).toBe('in_stock');
  });

  it('treats unmanaged variant stock quantities as non-authoritative', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          manage_stock: false,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Red' },
              stock_quantity: 0,
              sku: 'SKU-RED',
            },
            {
              id: 'var-2',
              attributes: { color: 'Blue' },
              stock_quantity: 2,
              sku: 'SKU-BLUE',
            },
          ],
        }),
      ],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const items = (await response.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'SKU-RED',
          availability: 'in_stock',
          quantity: 9999,
          return_policy_url: 'https://ogabassey.usebaci.com/returns',
        }),
        expect.objectContaining({
          id: 'SKU-BLUE',
          availability: 'in_stock',
          quantity: 9999,
          return_policy_url: 'https://ogabassey.usebaci.com/returns',
        }),
      ])
    );
  });

  it('uses variant stock_quantity when variant parent manages stock', async () => {
    mockGetCachedOpenAIFeedData.mockResolvedValue({
      products: [
        simpleProduct({
          manage_stock: true,
          variants: [
            {
              id: 'var-1',
              attributes: { color: 'Red' },
              stock_quantity: 3,
              sku: 'SKU-RED',
            },
          ],
        }),
      ],
    });
    const { GET } = await import('./route');
    const response = await GET(
      makeRequest('/api/feed/openai?merchant_slug=ogabassey')
    );
    const text = await response.text();
    const parsed = JSON.parse(text);

    expect(parsed.quantity).toBe(3);
    expect(parsed.availability).toBe('in_stock');
  });
});
