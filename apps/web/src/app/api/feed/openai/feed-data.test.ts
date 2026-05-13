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
  categories?: { name?: string | null; slug?: string | null } | null;
  created_at?: string | null;
  variants: Array<{
    id: string;
    attributes: Record<string, string>;
    stock_quantity: number;
    sku: string;
    primary_image: string;
  }>;
}

let productsResult: { data: ProductFixture[] | null; error: unknown };
const mockProductSelect = vi.fn();
const mockProductsOr = vi.fn();
const mockProductsOrder = vi.fn();
const mockProductsLimit = vi.fn();

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === 'products') {
        return {
          select: mockProductSelect.mockImplementation(() => ({
            eq: () => ({
              eq: () => ({
                or: mockProductsOr,
                order: mockProductsOrder,
                limit: mockProductsLimit,
              }),
            }),
          })),
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
  mockProductsOrder.mockReset();
  mockProductsLimit.mockReset();
  mockProductsOr.mockImplementation(() => ({
    order: mockProductsOrder,
    limit: mockProductsLimit,
  }));
  mockProductsOrder.mockImplementation(() => ({
    order: mockProductsOrder,
    limit: mockProductsLimit,
  }));
  mockProductsLimit.mockImplementation(() => Promise.resolve(productsResult));

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
  });

  it('selects canonical URL fields without reading a missing category_slug column', async () => {
    const { getCachedOpenAIFeedData } = await import('./feed-data');

    await getCachedOpenAIFeedData('merchant-1');

    const selectFragment = mockProductSelect.mock.calls[0]?.[0];
    expect(typeof selectFragment).toBe('string');
    if (typeof selectFragment !== 'string') {
      throw new Error('Expected products select fragment to be a string');
    }
    expect(selectFragment).toContain('canonical_url');
    expect(selectFragment).toContain('categories:category_id(name, slug)');
    expect(selectFragment).not.toContain('category_slug');
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

    expect(mockProductsLimit).toHaveBeenNthCalledWith(1, 1000);
    expect(mockProductsLimit).toHaveBeenNthCalledWith(2, 1000);
    expect(mockProductsOr).toHaveBeenCalledWith(
      'created_at.lt.2026-01-01T00:00:00.000Z,and(created_at.eq.2026-01-01T00:00:00.000Z,id.gt.prod-999)'
    );
    expect(mockProductsOrder).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(mockProductsOrder).toHaveBeenCalledWith('id', { ascending: true });
    expect(result.products).toHaveLength(1001);
  });

  it('does not throw when a full page ends without a usable created_at cursor', async () => {
    productsResult = {
      data: Array.from({ length: 1000 }, (_, index) => ({
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
      })),
      error: null,
    };

    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1');

    expect(mockProductsLimit).toHaveBeenCalledTimes(1);
    expect(result.products).toHaveLength(1000);
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
});
