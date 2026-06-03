import { describe, expect, it, jest } from '@jest/globals';

const mockPrefetchInfiniteQuery = jest.fn<() => Promise<void>>();
const mockPrefetchQuery = jest.fn<() => Promise<void>>();

jest.mock('@/lib/query-client', () => ({
  queryClient: {
    prefetchInfiniteQuery: mockPrefetchInfiniteQuery,
    prefetchQuery: mockPrefetchQuery,
  },
}));

jest.mock('@/hooks/product-utils', () => ({
  CONSTANT_MERCHANT_ID: 'merchant-123',
  fetchProductsPage: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('prefetchStartupStorefrontData', () => {
  it('prewarms home storefront queries once with the same products key used by ProductGrid', async () => {
    const {
      prefetchStartupStorefrontData,
      STARTUP_HOME_PRODUCTS_OPTIONS,
    } = require('./startup-storefront-prefetch') as typeof import('./startup-storefront-prefetch');

    mockPrefetchInfiniteQuery.mockResolvedValue(undefined);
    mockPrefetchQuery.mockResolvedValue(undefined);

    await prefetchStartupStorefrontData();
    await prefetchStartupStorefrontData();

    expect(mockPrefetchQuery).toHaveBeenCalledTimes(2);
    expect(mockPrefetchQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queryKey: ['categories', 'merchant-123'],
      })
    );
    expect(mockPrefetchQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queryKey: ['page_config', 'home', 'merchant-123'],
      })
    );
    expect(mockPrefetchInfiniteQuery).toHaveBeenCalledTimes(1);
    expect(mockPrefetchInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPageParam: 0,
        queryKey: ['products', 'merchant-123', STARTUP_HOME_PRODUCTS_OPTIONS],
      })
    );
  });
});
