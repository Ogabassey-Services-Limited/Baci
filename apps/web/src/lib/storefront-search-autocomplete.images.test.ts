import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorefrontAutocompleteProducts } from '@/lib/storefront-search-autocomplete';

const searchStorefrontProducts = vi.fn();
const VALID_MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

vi.mock('@/lib/storefront-search', () => ({
  searchStorefrontProducts: (...args: unknown[]) =>
    searchStorefrontProducts(...args),
}));

describe('getStorefrontAutocompleteProducts image normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null thumbnails for non-array and empty image payloads', async () => {
    searchStorefrontProducts.mockResolvedValueOnce({
      count: 2,
      didYouMean: null,
      productIds: ['p1', 'p2'],
      query: 'iphone',
    });

    const imageQuery = {
      select: vi.fn(() => imageQuery),
      in: vi.fn(() => imageQuery),
      eq: vi.fn(() => imageQuery),
      // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: 'p1',
              name: 'iPhone X',
              category: 'Smartphones',
              price: 240_000,
              images: [],
              slug: 'iphone-x',
            },
            {
              id: 'p2',
              name: 'iPhone 16 Pro',
              category: 'Smartphones',
              price: 1_200_000,
              images: { small: 'two.jpg' },
              slug: 'iphone-16-pro',
            },
          ],
          error: null,
        }).then(resolve),
    };
    const imageSupabase = {
      rpc: vi.fn(),
      from: vi.fn(() => imageQuery),
    };

    const result = await getStorefrontAutocompleteProducts({
      supabase: imageSupabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphone',
      limit: 10,
    });

    expect(result.suggestions.map((product) => product.image_small)).toEqual([
      null,
      null,
    ]);
  });

  it('resolves object-format image urls for suggestions', async () => {
    searchStorefrontProducts.mockResolvedValueOnce({
      count: 2,
      didYouMean: null,
      productIds: ['obj', 'str'],
      query: 'iphone',
    });
    const imageQuery = {
      select: vi.fn(() => imageQuery),
      in: vi.fn(() => imageQuery),
      eq: vi.fn(() => imageQuery),
      // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: 'obj',
              name: 'Object Image Phone',
              category: 'Smartphones',
              price: 500_000,
              images: [
                { url: 'https://cdn.example.com/obj.jpg', alt: '', order: 0 },
              ],
              slug: 'object-image-phone',
            },
            {
              id: 'str',
              name: 'String Image Phone',
              category: 'Smartphones',
              price: 400_000,
              images: ['https://cdn.example.com/str.jpg'],
              slug: 'string-image-phone',
            },
          ],
          error: null,
        }).then(resolve),
    };
    const imageSupabase = {
      rpc: vi.fn(),
      from: vi.fn(() => imageQuery),
    };

    const result = await getStorefrontAutocompleteProducts({
      supabase: imageSupabase as never,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphone',
      limit: 10,
    });

    const imageById = new Map(
      result.suggestions.map((product) => [product.id, product.image_small])
    );
    expect(imageById.get('obj')).toBe('https://cdn.example.com/obj.jpg');
    expect(imageById.get('str')).toBe('https://cdn.example.com/str.jpg');
  });
});
