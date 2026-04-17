import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
};

const mockCookies = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/app/api/storefront/products/product-response', () => ({
  STOREFRONT_PRODUCTS_COMPACT_SELECT: 'compact-select',
  mapStorefrontProduct: (product: {
    id: string;
    name: string;
    price: number;
    slug: string;
  }) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    slug: product.slug,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import {
  getStorefrontSearchProducts,
  InvalidMerchantIdError,
  searchStorefrontProducts,
} from './storefront-search';

describe('searchStorefrontProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes the query before calling the search rpc', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ product_id: 'prod-1', total_count: 1 }],
      error: null,
    });

    const rawQuery = '<script>alert(1)</script>iphone';
    const expectedQuery = sanitizeSearchQuery(rawQuery);

    await searchStorefrontProducts({
      supabase: mockSupabase as never,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: rawQuery,
      limit: 20,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        search_query: expectedQuery,
      })
    );
  });

  it('returns the shaped success response', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [{ product_id: 'prod-1', total_count: 2 }],
      error: null,
    });

    const result = await searchStorefrontProducts({
      supabase: mockSupabase as never,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: 'iphone',
      limit: 20,
    });

    expect(result).toEqual({
      count: 2,
      didYouMean: null,
      productIds: ['prod-1'],
      query: 'iphone',
    });
  });

  it('throws InvalidMerchantIdError for invalid merchant ids', async () => {
    await expect(
      searchStorefrontProducts({
        supabase: mockSupabase as never,
        merchantId: 'not-a-uuid',
        query: 'iphone',
        limit: 20,
      })
    ).rejects.toBeInstanceOf(InvalidMerchantIdError);
  });

  it('returns didYouMean when the first search has no matches', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ suggested_term: 'iphone' }],
        error: null,
      });

    const result = await searchStorefrontProducts({
      supabase: mockSupabase as never,
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: 'iphon',
      limit: 20,
    });

    expect(result.didYouMean).toBe('iphone');
  });
});

describe('getStorefrontSearchProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({});
  });

  it('hydrates search results and preserves the ranked order', async () => {
    vi.mocked(createClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: [
          { product_id: 'product-2', total_count: 2 },
          { product_id: 'product-1', total_count: 2 },
        ],
        error: null,
      }),
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as never);

    vi.mocked(createPublicClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'product-1',
                    name: 'Phone One',
                    price: 1000,
                    slug: 'phone-one',
                  },
                  {
                    id: 'product-2',
                    name: 'Phone Two',
                    price: 2000,
                    slug: 'phone-two',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      })),
    } as never);

    const result = await getStorefrontSearchProducts({
      merchantId: '123e4567-e89b-12d3-a456-426614174000',
      query: 'phone',
      limit: 20,
    });

    expect(result.products).toEqual([
      {
        id: 'product-2',
        name: 'Phone Two',
        price: 2000,
        slug: 'phone-two',
      },
      {
        id: 'product-1',
        name: 'Phone One',
        price: 1000,
        slug: 'phone-one',
      },
    ]);
  });
});
