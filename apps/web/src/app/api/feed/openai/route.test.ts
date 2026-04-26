import { gunzipSync } from 'node:zlib';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveFeedMerchant = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();

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
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean;
  images?: string[];
  updated_at: string;
  variants?: Array<{
    id: string;
    attributes: Record<string, string>;
    stock_quantity?: number;
    sku?: string;
  }>;
}

function makeRequest(path: string) {
  return new NextRequest(`https://example.com${path}`, {
    headers: { host: 'ogabassey.baci.app' },
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
