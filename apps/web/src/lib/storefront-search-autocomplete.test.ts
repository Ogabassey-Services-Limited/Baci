import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorefrontAutocompleteProducts } from './storefront-search-autocomplete';

const searchStorefrontProducts = vi.fn();
const productQuery = {
  select: vi.fn(() => productQuery),
  in: vi.fn(() => productQuery),
  eq: vi.fn(() => productQuery),
  // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({
      data: [
        {
          id: 'p2',
          name: 'iPhone 16 Pro',
          category: 'Smartphones',
          price: 1_200_000,
          images: ['two.jpg'],
          slug: 'iphone-16-pro',
        },
        {
          id: 'p1',
          name: 'iPhone X',
          category: 'Smartphones',
          price: 240_000,
          images: ['one.jpg'],
          slug: 'iphone-x',
        },
      ],
      error: null,
    }).then(resolve),
};

const supabase = {
  rpc: vi.fn(),
  from: vi.fn(() => productQuery),
};
const VALID_MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

vi.mock('./storefront-search', () => ({
  searchStorefrontProducts: (...args: unknown[]) =>
    searchStorefrontProducts(...args),
}));

describe('getStorefrontAutocompleteProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates ranked ids into autocomplete suggestions in ranked order', async () => {
    searchStorefrontProducts.mockResolvedValueOnce({
      count: 2,
      didYouMean: null,
      productIds: ['p1', 'p2'],
      query: 'iphnoe',
    });

    const result = await getStorefrontAutocompleteProducts({
      supabase: supabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphnoe',
      limit: 10,
    });

    expect(result.suggestions.map((product) => product.id)).toEqual([
      'p1',
      'p2',
    ]);
    expect(searchStorefrontProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'iphnoe',
        limit: 10,
        trackAnalytics: false,
      })
    );
    expect(result.popularSearches).toEqual([]);
  });

  it('returns empty suggestions for short queries without hitting the rpc', async () => {
    const result = await getStorefrontAutocompleteProducts({
      supabase: supabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'i',
      limit: 10,
    });

    expect(result).toEqual({ suggestions: [], popularSearches: [] });
    expect(searchStorefrontProducts).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
