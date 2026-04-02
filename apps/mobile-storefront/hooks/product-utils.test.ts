import type { QueryClient } from '@tanstack/react-query';

const mockWithSupabaseRetry = jest.fn();
const mockGetProductSlugFallbackCandidates = jest.fn();
const mockRemoveProductSlugFromProductsCache = jest.fn(
  (cached, slug) => ({ cached, slug })
);
const mockFrom = jest.fn();

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (
    operation: () => Promise<unknown>,
    options?: unknown
  ) => mockWithSupabaseRetry(operation, options),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    MERCHANT_ID: 'merchant-1',
    MERCHANT_SLUG: 'ogabassey',
  },
}));

jest.mock('@/lib/product-query-cache', () => ({
  removeProductSlugFromProductsCache: (cached: unknown, slug: string) =>
    mockRemoveProductSlugFromProductsCache(cached, slug),
}));

jest.mock('@/lib/product-slug-fallback', () => ({
  getProductSlugFallbackCandidates: (slug: string) =>
    mockGetProductSlugFallbackCandidates(slug),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_SELECT,
  fetchProductRow,
  fetchProductsPage,
  resolveAndEvictProduct,
  resolveProductRow,
  transformProduct,
} = require('./product-utils') as typeof import('./product-utils');

interface QueryResult {
  data?: unknown;
  error?: Error | null;
  count?: number | null;
}

interface MockQueryChain {
  data: unknown;
  error: Error | null;
  count: number | null;
  select: jest.Mock;
  eq: jest.Mock;
  ilike: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  maybeSingle: jest.Mock;
}

function createQueryChain(result: QueryResult): MockQueryChain {
  const chain = {} as MockQueryChain;
  chain.data = result.data ?? null;
  chain.error = result.error ?? null;
  chain.count = result.count ?? null;
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.ilike = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.range = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);

  return chain;
}

const validProductRow = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'iPhone 13 Pro',
  slug: 'iphone-13-pro',
  description: 'Flagship phone',
  price: 552000,
  compare_at_price: 600000,
  images: ['https://cdn.example.com/iphone-13-pro.jpg'],
  brand: 'Apple',
  color: 'Blue',
  condition: 'New',
  average_rating: 4.6,
  review_count: 18,
  manage_stock: true,
  stock: 4,
  stock_quantity: 4,
  status: 'active',
  specifications: { ram: '6GB' },
  has_variants: true,
  colors: ['Blue'],
  color_images: { Blue: ['https://cdn.example.com/iphone-13-pro-blue.jpg'] },
  has_condition_offers: true,
  offers: [
    {
      id: 'offer-used',
      condition: 'used',
      price: 510000,
      compare_at_price: 540000,
      stock_quantity: 2,
      images: ['https://cdn.example.com/iphone-13-pro-used.jpg'],
      condition_notes: 'Excellent condition',
      grade: 'A',
    },
  ],
  variants: [
    {
      id: 'variant-128gb',
      product_id: '123e4567-e89b-12d3-a456-426614174000',
      merchant_id: 'merchant-1',
      sku: 'IPHONE-13-PRO-128',
      price_override: 552000,
      primary_image: 'https://cdn.example.com/iphone-13-pro-128.jpg',
      images: ['https://cdn.example.com/iphone-13-pro-128.jpg'],
      stock_quantity: 4,
      attributes: { storage: '128GB' },
    },
  ],
  variant_attributes: [{ param: 'Storage', options: ['128GB', '256GB'] }],
  categories: [{ id: 'cat-1', name: 'Phones', slug: 'phones' }],
};

describe('product-utils', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockWithSupabaseRetry.mockImplementation(async (operation) => operation());
    mockGetProductSlugFallbackCandidates.mockReturnValue([]);
  });

  it('fetchProductRow scopes product lookups by merchant, status, and slug', async () => {
    const query = createQueryChain({ data: validProductRow, error: null });
    mockFrom.mockReturnValue(query);

    const result = await fetchProductRow(
      'merchant-1',
      'iphone-13-pro',
      'Product'
    );

    expect(result).toEqual({ data: validProductRow, error: null });
    expect(mockFrom).toHaveBeenCalledWith('products');
    expect(query.select).toHaveBeenCalledWith(PRODUCT_DETAIL_SELECT);
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('slug', 'iphone-13-pro');
  });

  it('resolveProductRow falls back to legacy slug candidates', async () => {
    const exactQuery = createQueryChain({ data: null, error: null });
    const fallbackQuery = createQueryChain({ data: validProductRow, error: null });
    mockFrom.mockReturnValueOnce(exactQuery).mockReturnValueOnce(fallbackQuery);
    mockGetProductSlugFallbackCandidates.mockReturnValue(['iphone-13-pro']);

    const result = await resolveProductRow(
      'merchant-1',
      'iphone-13-pro-128gb-premium-used'
    );

    expect(result).toEqual(validProductRow);
  });

  it('resolveAndEvictProduct clears stale product caches when a product is gone', async () => {
    const queryClient = {
      removeQueries: jest.fn(),
      setQueriesData: jest.fn(),
    } as unknown as QueryClient;
    const missingQuery = createQueryChain({ data: null, error: null });
    mockFrom.mockReturnValue(missingQuery);

    await expect(
      resolveAndEvictProduct('merchant-1', 'missing-slug', queryClient)
    ).rejects.toThrow(
      'This product is no longer available. Refresh the app to remove outdated product cards.'
    );

    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'missing-slug', 'merchant-1'],
      exact: true,
    });
    expect(queryClient.setQueriesData).toHaveBeenCalledTimes(1);

    const updater = (queryClient.setQueriesData as jest.Mock).mock.calls[0][1];
    expect(updater('cached-pages')).toEqual({
      cached: 'cached-pages',
      slug: 'missing-slug',
    });
    expect(mockRemoveProductSlugFromProductsCache).toHaveBeenCalledWith(
      'cached-pages',
      'missing-slug'
    );
  });

  it('transformProduct converts validated rows and rejects malformed rows', () => {
    expect(transformProduct(validProductRow)).toMatchObject({
      id: validProductRow.id,
      name: validProductRow.name,
      slug: validProductRow.slug,
      image: validProductRow.images[0],
      rating: validProductRow.average_rating,
      review_count: validProductRow.review_count,
      category: 'Phones',
      colors: validProductRow.colors,
      color_images: validProductRow.color_images,
      has_condition_offers: true,
      offers: [
        expect.objectContaining({
          id: 'offer-used',
          condition: 'used',
          price: 510000,
        }),
      ],
      in_stock: true,
    });

    expect(transformProduct({ id: 'bad-id' })).toBeNull();
  });

  it('transformProduct uses effective stock when stock_quantity drifted to zero', () => {
    expect(
      transformProduct({
        ...validProductRow,
        stock: 7,
        stock_quantity: 0,
        manage_stock: true,
      })
    ).toMatchObject({
      stock_quantity: 7,
      in_stock: true,
    });
  });

  it('transformProduct normalizes lowercase condition labels to sentence case', () => {
    expect(
      transformProduct({
        ...validProductRow,
        condition: 'refurbished',
      })
    ).toMatchObject({
      condition: 'Refurbished',
    });
  });

  it('fetchProductsPage applies filters, paginates, and returns transformed products', async () => {
    const query = createQueryChain({
      data: [
        validProductRow,
        {
          ...validProductRow,
          id: 'bad-id',
        },
      ],
      error: null,
      count: 3,
    });
    mockFrom.mockReturnValue(query);

    const result = await fetchProductsPage(
      'merchant-1',
      {
        category: 'cat-1',
        search: 'iphone',
        condition: 'New',
        brand: 'Apple',
        minPrice: 400000,
        maxPrice: 600000,
        minRating: 4,
        sortBy: 'price_desc',
        limit: 2,
      },
      0
    );

    expect(query.select).toHaveBeenCalledWith(PRODUCT_SELECT, { count: 'exact' });
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(query.eq).toHaveBeenCalledWith('condition', 'New');
    expect(query.eq).toHaveBeenCalledWith('brand', 'Apple');
    expect(query.ilike).toHaveBeenCalledWith('name', '%iphone%');
    expect(query.gte).toHaveBeenCalledWith('price', 400000);
    expect(query.lte).toHaveBeenCalledWith('price', 600000);
    expect(query.gte).toHaveBeenCalledWith('average_rating', 4);
    expect(query.order).toHaveBeenCalledWith('price', { ascending: false });
    expect(query.range).toHaveBeenCalledWith(0, 1);
    expect(result).toMatchObject({
      total: 3,
      nextOffset: 2,
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.slug).toBe(validProductRow.slug);
  });
});
