import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutocompleteSupabase } from '@/lib/storefront-search-autocomplete';
import { getStorefrontAutocompleteProducts } from '@/lib/storefront-search-autocomplete';

const searchStorefrontProducts = vi.fn();
const VALID_MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

type ImageProductRow = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  images: unknown;
  slug: string;
};

type ImageQueryResult = {
  data: ImageProductRow[];
  error: null;
};

type ImageQuery = PromiseLike<ImageQueryResult> & {
  in: (column: string, values: string[]) => ImageQuery;
  eq: (column: string, value: string) => ImageQuery;
};

function createImageSupabase(rows: ImageProductRow[]): AutocompleteSupabase {
  const result = { data: rows, error: null } satisfies ImageQueryResult;
  const query: ImageQuery = {
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };

  return {
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => query),
    })),
  };
}

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

    const imageSupabase = createImageSupabase([
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
    ]);

    const result = await getStorefrontAutocompleteProducts({
      supabase: imageSupabase,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphone-empty-images',
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
    const imageSupabase = createImageSupabase([
      {
        id: 'obj',
        name: 'Object Image Phone',
        category: 'Smartphones',
        price: 500_000,
        images: [{ url: 'https://cdn.example.com/obj.jpg', alt: '', order: 0 }],
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
    ]);

    const result = await getStorefrontAutocompleteProducts({
      supabase: imageSupabase,
      merchantId: VALID_MERCHANT_ID,
      query: 'iphone-object-images',
      limit: 10,
    });

    const imageById = new Map(
      result.suggestions.map((product) => [product.id, product.image_small])
    );
    expect(imageById.get('obj')).toBe('https://cdn.example.com/obj.jpg');
    expect(imageById.get('str')).toBe('https://cdn.example.com/str.jpg');
  });
});
