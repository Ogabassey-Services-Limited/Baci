import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProductSeoInventory } from './get-product-seo-link-inventory';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

vi.mock('@/lib/product-key-specs-select', () => ({
  PRODUCT_KEY_SPECS_RELATION_SELECT: 'product_key_specs',
}));

interface QueryResponse {
  data: unknown[] | Record<string, unknown> | null;
  error: unknown | null;
}

const canonicalProduct = {
  id: 'new-prod',
  slug: 'new-product',
  name: 'New Product',
  brand: 'Apple',
  condition: 'new',
  price: 2_000,
  category_id: 'cat-1',
  stock: 4,
  stock_quantity: null,
  category: 'Laptops',
  product_key_specs: { ram: '16GB' },
};
const olderProduct = {
  id: 'old-prod',
  slug: 'older-product',
  name: 'Older Product',
  brand: 'Lenovo',
  condition: 'used',
  price: 1_000,
  category_id: 'cat-1',
  stock: 1,
  stock_quantity: null,
  category: null,
  product_key_specs: { ram: '8GB' },
};

let categoryResponses: QueryResponse[];
let productResponses: QueryResponse[];
let rpcResponses: QueryResponse[];
let productQueries: Record<string, ReturnType<typeof vi.fn>>[];

function createQuery(response: () => QueryResponse) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'or', 'in', 'order']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.limit = vi.fn(() => Promise.resolve(response()));
  builder.maybeSingle = vi.fn(() => Promise.resolve(response()));
  return builder;
}

function setupSupabaseMock() {
  productQueries = [];
  mocks.rpc.mockImplementation(() =>
    Promise.resolve(rpcResponses.shift() ?? { data: null, error: null })
  );
  mocks.from.mockImplementation((table: string) => {
    if (table === 'categories') {
      return createQuery(
        () => categoryResponses.shift() ?? { data: null, error: null }
      );
    }
    if (table === 'products') {
      const query = createQuery(
        () => productResponses.shift() ?? { data: [], error: null }
      );
      productQueries.push(query);
      return query;
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

describe('getProductSeoInventory enrichment rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    categoryResponses = [
      {
        data: {
          id: 'cat-1',
          name: 'Laptops',
          slug: 'laptops',
          is_active: true,
        },
        error: null,
      },
      { data: [{ id: 'cat-1' }, { id: 'cat-child' }], error: null },
    ];
    productResponses = [{ data: [canonicalProduct], error: null }];
    rpcResponses = [];
    setupSupabaseMock();
  });

  it('normalizes embedded product key specs relation rows before semantic comparisons', async () => {
    productResponses = [
      { data: [], error: null },
      {
        data: [
          {
            ...canonicalProduct,
            product_key_specs: [
              {
                ram: '16GB',
                storage: '512GB',
                processor: 'M3',
              },
            ],
          },
        ],
        error: null,
      },
    ];

    const result = await getProductSeoInventory('merchant-1', 'laptops', '');

    expect(result).toEqual([
      expect.objectContaining({
        slug: 'new-product',
        product_key_specs: {
          ram: '16GB',
          storage: '512GB',
          processor: 'M3',
        },
      }),
    ]);
  });

  it('preserves products whose price arrives as a numeric string', async () => {
    productResponses = [
      {
        data: [
          {
            ...canonicalProduct,
            price: '2000',
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ];

    const result = await getProductSeoInventory('merchant-1', 'laptops', '');

    expect(result).toEqual([
      expect.objectContaining({
        slug: 'new-product',
        price: 2000,
      }),
    ]);
  });

  it('selects and prefers current stock_quantity over stale legacy stock', async () => {
    productResponses = [
      { data: [], error: null },
      {
        data: [
          {
            ...canonicalProduct,
            stock: 0,
            stock_quantity: 5,
          },
        ],
        error: null,
      },
    ];

    const result = await getProductSeoInventory('merchant-1', 'laptops', '');

    expect(productQueries[0].select).toHaveBeenCalledWith(
      expect.stringContaining('stock_quantity')
    );
    expect(result).toEqual([
      expect.objectContaining({
        slug: 'new-product',
        stock: 5,
      }),
    ]);
  });

  it('force-includes the current PDP product beyond the bounded inventory slice', async () => {
    productResponses = [
      { data: [olderProduct], error: null },
      { data: [], error: null },
      { data: [canonicalProduct], error: null },
    ];

    const result = await getProductSeoInventory(
      'merchant-1',
      'laptops',
      'old-prod'
    );

    expect(result.map((product) => product.slug)).toEqual(
      expect.arrayContaining(['older-product', 'new-product'])
    );
  });

  it('does not throw when a legacy slug contains a literal percent sign', async () => {
    categoryResponses = [{ data: null, error: null }];
    rpcResponses = [{ data: [{ is_active: true }], error: null }];
    productResponses = [{ data: [], error: null }];

    await expect(
      getProductSeoInventory('merchant-1', '50%-off-sale', '')
    ).resolves.toEqual([]);
    expect(productQueries[0].or).toHaveBeenCalledWith(
      'category.ilike.%50 off sale%,brand.ilike.%50 off sale%,name.ilike.%50 off sale%'
    );
  });

  it('does not use legacy text fallback for RLS-hidden inactive categories', async () => {
    categoryResponses = [{ data: null, error: null }];
    rpcResponses = [{ data: [{ is_active: false }], error: null }];
    productResponses = [{ data: [canonicalProduct], error: null }];

    await expect(
      getProductSeoInventory('merchant-1', 'inactive-laptops', '')
    ).resolves.toEqual([]);

    expect(mocks.rpc).toHaveBeenCalledWith(
      'get_storefront_category_slug_state',
      {
        p_merchant_id: 'merchant-1',
        p_slug: 'inactive-laptops',
      }
    );
    expect(productQueries).toHaveLength(0);
  });

  it('throws on transient inventory failures so degraded results are not cached', async () => {
    productResponses = [{ data: [], error: { message: 'timeout' } }];

    await expect(
      getProductSeoInventory('merchant-1', 'laptops', '')
    ).rejects.toThrow(/transient/i);
  });
});
