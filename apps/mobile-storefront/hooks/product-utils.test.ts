import { jest } from '@jest/globals';
import type { QueryClient } from '@tanstack/react-query';

const mockWithSupabaseRetry: jest.Mock = jest.fn();
const mockGetProductSlugFallbackCandidates = jest.fn();
const mockRemoveProductSlugFromProductsCache = jest.fn((cached, slug) => ({
  cached,
  slug,
}));
const mockFrom: jest.Mock = jest.fn();
const mockRpc: jest.Mock = jest.fn();

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (operation: () => Promise<unknown>, options?: unknown) =>
    mockWithSupabaseRetry(operation, options),
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
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const {
  fetchAvailableBrands,
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
  or: jest.Mock;
  in: jest.Mock;
  ilike: jest.Mock;
  textSearch: jest.Mock;
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
  chain.or = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.ilike = jest.fn(() => chain);
  chain.textSearch = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.range = jest.fn(() => chain);
  chain.maybeSingle = jest.fn(async () => result);

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
  variant_model: 'legacy',
  available_conditions: ['new'],
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
    mockWithSupabaseRetry.mockImplementation((...args: unknown[]) => {
      const operation = args[0] as () => Promise<unknown> | unknown;
      return operation();
    });
    mockGetProductSlugFallbackCandidates.mockReturnValue([]);
    mockRpc.mockReset();
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
    const fallbackQuery = createQueryChain({
      data: validProductRow,
      error: null,
    });
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

    const updater = (queryClient.setQueriesData as jest.Mock).mock
      .calls[0][1] as (cached: unknown) => unknown;
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

  it('transformProduct accepts object-based product images from live rows', () => {
    expect(
      transformProduct({
        ...validProductRow,
        images: [
          { url: 'https://cdn.example.com/iphone-13-pro-front.jpg' },
          { src: 'https://cdn.example.com/iphone-13-pro-back.jpg' },
        ],
      })
    ).toMatchObject({
      image: 'https://cdn.example.com/iphone-13-pro-front.jpg',
      images: [
        'https://cdn.example.com/iphone-13-pro-front.jpg',
        'https://cdn.example.com/iphone-13-pro-back.jpg',
      ],
    });
  });

  it('transformProduct flattens section-array specifications from live product rows', () => {
    expect(
      transformProduct({
        ...validProductRow,
        specifications: [
          {
            category: 'Specs',
            items: [
              { label: 'Brand', value: 'HP' },
              { label: 'RAM', value: '16GB' },
            ],
          },
        ],
      })
    ).toMatchObject({
      specifications: {
        Brand: 'HP',
        RAM: '16GB',
      },
    });
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

  it('transformProduct canonicalizes legacy condition aliases into display labels', () => {
    expect(
      transformProduct({
        ...validProductRow,
        condition: 'refurbished',
        has_condition_offers: false,
      })
    ).toMatchObject({
      condition: 'Open Box',
    });
  });

  it('transformProduct treats multi-condition sku_matrix products as mixed-condition labels', () => {
    expect(
      transformProduct({
        ...validProductRow,
        condition: 'new',
        has_condition_offers: false,
        available_conditions: ['new', 'used'],
        variant_model: 'sku_matrix',
      })
    ).toMatchObject({
      condition: 'New & Used',
      variant_model: 'sku_matrix',
      available_conditions: ['new', 'used'],
    });
  });

  it('fetchProductsPage applies filters, paginates, and returns transformed products', async () => {
    const rankedResults = [
      {
        product_id: validProductRow.id,
        relevance: 9.8,
        total_count: 3,
      },
      {
        product_id: 'bad-id',
        relevance: 7.9,
        total_count: 3,
      },
    ];
    const query = createQueryChain({
      data: [
        {
          ...validProductRow,
          id: 'bad-id',
        },
        validProductRow,
      ],
      error: null,
    });
    mockRpc.mockImplementation(async () => ({
      data: rankedResults,
      error: null,
    }));
    mockFrom.mockReturnValue(query);

    const result = await fetchProductsPage(
      'merchant-1',
      {
        category: 'cat-1',
        search: 'iphone14promax',
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

    expect(mockRpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        brand_filter: 'Apple',
        category_id_filter: 'cat-1',
        condition_filter: 'new',
        max_price_filter: 600000,
        merchant_id_param: 'merchant-1',
        min_price_filter: 400000,
        min_rating_filter: 4,
        result_limit: 2,
        result_offset: 0,
        search_query: 'iphone 14 pro max',
        sort_by: 'price_desc',
        status_filter: 'active',
      })
    );
    expect(query.select).toHaveBeenCalledWith(PRODUCT_SELECT);
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.in).toHaveBeenCalledWith('id', [validProductRow.id, 'bad-id']);
    expect(result).toMatchObject({
      total: 3,
      nextOffset: 2,
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.slug).toBe(validProductRow.slug);
  });

  it('fetchProductsPage throws when the ranked search rpc fails', async () => {
    mockRpc.mockImplementation(async () => ({
      data: null,
      error: new Error('search rpc failed'),
    }));

    await expect(
      fetchProductsPage(
        'merchant-1',
        {
          search: 'iphone14promax',
          limit: 2,
        },
        0
      )
    ).rejects.toThrow('search rpc failed');
  });

  it('fetchProductsPage throws when the ranked product row lookup fails', async () => {
    const query = createQueryChain({
      data: null,
      error: new Error('search rows failed'),
    });

    mockRpc.mockImplementation(async () => ({
      data: [
        {
          product_id: validProductRow.id,
          relevance: 9.8,
          total_count: 1,
        },
      ],
      error: null,
    }));
    mockFrom.mockReturnValue(query);

    await expect(
      fetchProductsPage(
        'merchant-1',
        {
          search: 'iphone14promax',
          limit: 2,
        },
        0
      )
    ).rejects.toThrow('search rows failed');
  });

  it('fetchAvailableBrands returns unique brands across matching rows', async () => {
    const query = createQueryChain({
      data: [
        { brand: 'Samsung' },
        { brand: 'Infinix' },
        { brand: 'Samsung' },
        { brand: null },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(query);

    await expect(
      fetchAvailableBrands('merchant-1', {
        category: 'cat-1',
        condition: 'Open Box',
        minPrice: 100000,
      })
    ).resolves.toEqual(['Infinix', 'Samsung']);

    expect(query.select).toHaveBeenCalledWith('brand');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('category_id', 'cat-1');
    expect(query.or).toHaveBeenCalledWith(
      'condition.eq.open_box,available_conditions.cs.{open_box}'
    );
    expect(query.gte).toHaveBeenCalledWith('price', 100000);
  });

  it('fetchAvailableBrands normalizes compact search queries before filtering', async () => {
    const query = createQueryChain({
      data: [
        { id: 'prod-2', brand: 'Samsung' },
        { id: 'prod-1', brand: 'Apple' },
      ],
      error: null,
    });
    mockRpc.mockImplementation(async () => ({
      data: [
        { product_id: 'prod-1', relevance: 9.1, total_count: 2 },
        { product_id: 'prod-2', relevance: 8.4, total_count: 2 },
      ],
      error: null,
    }));
    mockFrom.mockReturnValue(query);

    await fetchAvailableBrands('merchant-1', {
      search: 'iphone14promax',
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({
        merchant_id_param: 'merchant-1',
        search_query: 'iphone 14 pro max',
        status_filter: 'active',
      })
    );
    expect(query.in).toHaveBeenCalledWith('id', ['prod-1', 'prod-2']);
  });
});
