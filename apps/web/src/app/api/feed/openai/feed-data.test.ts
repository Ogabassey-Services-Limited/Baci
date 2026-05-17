import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateAnonClient = vi.fn();

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => mockCreateAnonClient(),
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

interface ProductFixture {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: number;
  stock: number;
  stock_quantity: number;
  manage_stock: boolean;
  canonical_url?: string | null;
  category?: string | null;
  category_slug?: string | null;
  categories?: { name?: string | null; slug?: string | null } | null;
  product_categories?: Array<{
    categories?: { name?: string | null; slug?: string | null } | null;
  }> | null;
  created_at?: string | null;
  variants: Array<{
    id: string;
    attributes: Record<string, string>;
    stock_quantity: number;
    sku: string;
    primary_image: string;
  }>;
}

interface ReviewFixture {
  id: string;
  product_id: string | null;
  rating: number | string | null;
}

let productsResult: { data: ProductFixture[] | null; error: unknown };
let nullCreatedAtProductsResult: {
  data: ProductFixture[] | null;
  error: unknown;
};
let reviewsResult: { data: ReviewFixture[] | null; error: unknown };
const mockProductSelect = vi.fn();
const mockProductsGt = vi.fn();
const mockProductsIs = vi.fn();
const mockProductsOr = vi.fn();
const mockProductsNot = vi.fn();
const mockProductsOrder = vi.fn();
const mockProductsLimit = vi.fn();
const mockReviewSelect = vi.fn();
const mockReviewsOrder = vi.fn();
const mockReviewsRange = vi.fn();
const mockReviewsIn = vi.fn();
let productQueryMode: 'non_null' | 'null' = 'non_null';

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === 'products') {
        return {
          select: mockProductSelect.mockImplementation(() => {
            const query = {
              eq: () => query,
              not: (column: string, operator: string, value: unknown) => {
                productQueryMode = 'non_null';
                mockProductsNot(column, operator, value);
                return query;
              },
              is: (column: string, value: unknown) => {
                if (column === 'created_at' && value === null) {
                  productQueryMode = 'null';
                }
                mockProductsIs(column, value);
                return query;
              },
              gt: (column: string, value: string) => {
                mockProductsGt(column, value);
                return query;
              },
              or: (filter: string) => {
                mockProductsOr(filter);
                return query;
              },
              order: (
                column: string,
                options?: {
                  ascending: boolean;
                }
              ) => {
                mockProductsOrder(column, options);
                return query;
              },
              limit: (value: number) => mockProductsLimit(value),
            };
            return query;
          }),
        };
      }
      if (table === 'product_reviews') {
        return {
          select: mockReviewSelect.mockImplementation(() => {
            const query = {
              eq: () => query,
              in: (column: string, values: string[]) => {
                mockReviewsIn(column, values);
                return query;
              },
              order: (
                column: string,
                options?: {
                  ascending: boolean;
                }
              ) => {
                mockReviewsOrder(column, options);
                return query;
              },
              range: (from: number, to: number) => mockReviewsRange(from, to),
            };
            return query;
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProductSelect.mockReset();
  mockProductsOr.mockReset();
  mockProductsNot.mockReset();
  mockProductsIs.mockReset();
  mockProductsGt.mockReset();
  mockProductsOrder.mockReset();
  mockProductsLimit.mockReset();
  mockReviewSelect.mockReset();
  mockReviewsOrder.mockReset();
  mockReviewsRange.mockReset();
  mockReviewsIn.mockReset();
  productQueryMode = 'non_null';
  mockProductsLimit.mockImplementation(() =>
    Promise.resolve(
      productQueryMode === 'null' ? nullCreatedAtProductsResult : productsResult
    )
  );
  mockReviewsRange.mockImplementation(() => Promise.resolve(reviewsResult));

  productsResult = {
    data: [
      {
        id: 'prod-1',
        name: 'Test Phone',
        created_at: '2026-01-01T00:00:00.000Z',
        description: 'A phone',
        slug: 'test-phone',
        price: 50000,
        stock: 5,
        stock_quantity: 5,
        manage_stock: true,
        variants: [
          {
            id: 'var-1',
            attributes: { color: 'Red' },
            stock_quantity: 3,
            sku: 'SKU-RED',
            primary_image: 'https://cdn.example.com/red.jpg',
          },
        ],
      },
    ],
    error: null,
  };
  nullCreatedAtProductsResult = { data: [], error: null };
  reviewsResult = { data: [], error: null };
  mockCreateAnonClient.mockReturnValue(createMockSupabase());
});

describe('getCachedOpenAIFeedData', () => {
  it('returns products with correct shape including manage_stock and variants', async () => {
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        id: 'prod-1',
        name: 'Test Phone',
        manage_stock: true,
        stock_quantity: 5,
      })
    );
    expect(result.products[0].variants).toHaveLength(1);
    expect(result.products[0].variants?.[0]).toEqual(
      expect.objectContaining({
        id: 'var-1',
        attributes: { color: 'Red' },
        stock_quantity: 3,
        sku: 'SKU-RED',
      })
    );
    expect(mockProductSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        'variants:product_variants!product_variants_product_id_fkey('
      )
    );
    expect(mockReviewSelect).toHaveBeenCalledWith('id, product_id, rating');
    expect(mockReviewsIn).toHaveBeenCalledWith('product_id', ['prod-1']);
  });

  it('selects canonical URL and joined category fields without reading a missing category_slug column', async () => {
    const { getCachedOpenAIFeedData } = await import('./feed-data');

    await getCachedOpenAIFeedData('merchant-1');

    const selectFragment = mockProductSelect.mock.calls[0]?.[0];
    expect(typeof selectFragment).toBe('string');
    if (typeof selectFragment !== 'string') {
      throw new Error('Expected products select fragment to be a string');
    }
    expect(selectFragment).toContain('canonical_url');
    expect(selectFragment).toContain('categories:category_id(name, slug)');
    expect(selectFragment).toContain(
      'product_categories(categories(name, slug))'
    );
    expect(selectFragment).not.toContain('category_slug');
  });

  it('prefers direct category_id relation over product_categories for canonical URL parity', async () => {
    productsResult = {
      data: [
        {
          id: 'prod-1',
          name: 'Test Phone',
          created_at: '2026-01-01T00:00:00.000Z',
          description: 'A phone',
          slug: 'test-phone',
          price: 50000,
          stock: 5,
          stock_quantity: 5,
          manage_stock: true,
          category: 'Legacy Phones',
          categories: { name: 'Legacy Phones', slug: 'legacy-phones' },
          product_categories: [
            {
              categories: { name: 'Phones', slug: 'phones' },
            },
          ],
          variants: [],
        },
      ],
      error: null,
    };
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(result.products[0]).toMatchObject({
      category: 'Legacy Phones',
      category_slug: 'legacy-phones',
      categories: { name: 'Legacy Phones', slug: 'legacy-phones' },
    });
    expect(result.products[0]).not.toHaveProperty('product_categories');
  });

  it('returns empty products array when no products exist', async () => {
    productsResult = { data: [], error: null };
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(result.products).toEqual([]);
  });

  it('paginates products with a stable cursor beyond the first Supabase page', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `prod-${index}`,
      name: `Phone ${index}`,
      created_at: '2026-01-01T00:00:00.000Z',
      description: 'A phone',
      slug: `phone-${index}`,
      price: 50000,
      stock: 5,
      stock_quantity: 5,
      manage_stock: true,
      variants: [],
    }));
    mockProductsLimit
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-1000',
            name: 'Phone 1000',
            created_at: '2026-01-01T00:00:00.000Z',
            description: 'A phone',
            slug: 'phone-1000',
            price: 50000,
            stock: 5,
            stock_quantity: 5,
            manage_stock: true,
            variants: [],
          },
        ],
        error: null,
      });

    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(mockProductsLimit).toHaveBeenCalledTimes(3);
    expect(mockProductsLimit).toHaveBeenNthCalledWith(1, 1000);
    expect(mockProductsLimit).toHaveBeenNthCalledWith(2, 1000);
    expect(mockProductsOr).toHaveBeenCalledWith(
      'created_at.lt.2026-01-01T00:00:00.000Z,and(created_at.eq.2026-01-01T00:00:00.000Z,id.gt.prod-999)'
    );
    expect(mockProductsIs).toHaveBeenCalledWith('created_at', null);
    expect(mockProductsOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(mockProductsOrder).toHaveBeenCalledWith('id', { ascending: true });
    expect(result.products).toHaveLength(1001);
  });

  it('continues pagination across null created_at pages', async () => {
    productsResult = { data: [], error: null };
    const nullFullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `prod-${index}`,
      name: `Phone ${index}`,
      created_at: null,
      description: 'A phone',
      slug: `phone-${index}`,
      price: 50000,
      stock: 5,
      stock_quantity: 5,
      manage_stock: true,
      variants: [],
    }));
    mockProductsLimit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: nullFullPage, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'prod-1000',
            name: 'Phone 1000',
            created_at: null,
            description: 'A phone',
            slug: 'phone-1000',
            price: 50000,
            stock: 5,
            stock_quantity: 5,
            manage_stock: true,
            variants: [],
          },
        ],
        error: null,
      });

    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(mockProductsLimit).toHaveBeenCalledTimes(3);
    expect(mockProductsIs).toHaveBeenCalledWith('created_at', null);
    expect(mockProductsGt).toHaveBeenCalledWith('id', 'prod-999');
    expect(result.products).toHaveLength(1001);
  });

  it('throws and logs when products query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error noise in tests
      () => {}
    );
    productsResult = {
      data: null,
      error: { message: 'connection error' },
    };
    const { getCachedOpenAIFeedData } = await import('./feed-data');

    await expect(getCachedOpenAIFeedData('merchant-1')).rejects.toThrow(
      'Failed to fetch products'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'DB_PRODUCTS_ERROR:',
      expect.objectContaining({
        error: expect.objectContaining({ message: 'connection error' }),
        merchantId: 'merchant-1',
        cursor: null,
      })
    );
    consoleSpy.mockRestore();
  });

  it('hydrates review_count and average_rating from approved review rows', async () => {
    productsResult = {
      data: [
        {
          id: 'prod-1',
          name: 'Test Phone',
          created_at: '2026-01-01T00:00:00.000Z',
          description: 'A phone',
          slug: 'test-phone',
          price: 50000,
          stock: 5,
          stock_quantity: 5,
          manage_stock: true,
          variants: [],
        },
      ],
      error: null,
    };
    reviewsResult = {
      data: [
        { id: 'review-1', product_id: 'prod-1', rating: 5 },
        { id: 'review-2', product_id: 'prod-1', rating: 4 },
      ],
      error: null,
    };

    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(result.products[0]).toMatchObject({
      average_rating: 4.5,
      review_count: 2,
    });
  });
});
