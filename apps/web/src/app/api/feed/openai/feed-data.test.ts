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
  variants: Array<{
    id: string;
    attributes: Record<string, string>;
    stock_quantity: number;
    sku: string;
    primary_image: string;
  }>;
}

let productsResult: { data: ProductFixture[] | null; error: unknown };
let domainResult: {
  data: { domain: string } | null;
  error: unknown;
};

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table === 'domains') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve(domainResult),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve(productsResult),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  productsResult = {
    data: [
      {
        id: 'prod-1',
        name: 'Test Phone',
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

  domainResult = {
    data: null,
    error: null,
  };

  mockCreateAnonClient.mockReturnValue(createMockSupabase());
});

describe('getCachedOpenAIFeedData', () => {
  it('returns products with correct shape including manage_stock and variants', async () => {
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1', 'test-store');

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
  });

  it('returns empty products array when no products exist', async () => {
    productsResult = { data: [], error: null };
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1', 'test-store');

    expect(result.products).toEqual([]);
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

    await expect(
      getCachedOpenAIFeedData('merchant-1', 'test-store')
    ).rejects.toThrow('Failed to fetch products');
    expect(consoleSpy).toHaveBeenCalledWith(
      'DB_PRODUCTS_ERROR:',
      expect.objectContaining({ message: 'connection error' })
    );
    consoleSpy.mockRestore();
  });

  it('returns custom_domain when merchant has an active primary domain', async () => {
    domainResult = { data: { domain: 'ogabassey.com' }, error: null };
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1', 'test-store');

    expect(result.custom_domain).toBe('ogabassey.com');
  });

  it('returns null custom_domain when merchant has no primary domain', async () => {
    domainResult = { data: null, error: null };
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1', 'test-store');

    expect(result.custom_domain).toBeNull();
  });

  it('returns the merchant slug passed as argument', async () => {
    const { getCachedOpenAIFeedData } = await import('./feed-data');
    const result = await getCachedOpenAIFeedData('merchant-1', 'ogabassey');

    expect(result.slug).toBe('ogabassey');
  });

  it('throws when domain query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error noise in tests
      () => {}
    );
    domainResult = {
      data: null,
      error: { message: 'domain query failed' },
    };
    const { getCachedOpenAIFeedData } = await import('./feed-data');

    await expect(
      getCachedOpenAIFeedData('merchant-1', 'test-store')
    ).rejects.toThrow('Failed to fetch merchant domain');
    consoleSpy.mockRestore();
  });
});
