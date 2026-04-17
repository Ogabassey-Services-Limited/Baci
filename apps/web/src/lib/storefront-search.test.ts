import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
};

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { sanitizeSearchQuery } from '@/lib/sanitize-core';
import {
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
