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

describe('getProductSeoInventory category scoping', () => {
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

  it('uses canonical category membership before legacy text matching', async () => {
    productResponses = [{ data: [] }, { data: [canonicalProduct] }].map(
      (response) => ({ ...response, error: null })
    );
    const result = await getProductSeoInventory('merchant-1', 'laptops', '');

    expect(productQueries).toHaveLength(2);
    expect(productQueries[0].in).toHaveBeenCalledWith('category_id', [
      'cat-1',
      'cat-child',
    ]);
    expect(productQueries[1].in).toHaveBeenCalledWith(
      'product_categories.category_id',
      ['cat-1', 'cat-child']
    );
    expect(productQueries[0].or).not.toHaveBeenCalled();
    expect(productQueries[1].or).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        slug: 'new-product',
        category_slug: 'laptops',
      }),
    ]);
  });

  it('uses joined child-category slugs for canonical semantic product links', async () => {
    productResponses = [
      { data: [], error: null },
      {
        data: [
          {
            ...canonicalProduct,
            product_categories: [
              {
                category_id: 'cat-child',
                categories: { slug: 'gaming-laptops' },
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
        category_slug: 'gaming-laptops',
      }),
    ]);
  });

  it('includes products assigned only through the direct category_id relation', async () => {
    productResponses = [
      {
        data: [
          {
            ...canonicalProduct,
            product_categories: [],
            categories: { slug: 'laptops' },
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ];

    const result = await getProductSeoInventory('merchant-1', 'laptops', '');

    expect(productQueries[0].in).toHaveBeenCalledWith('category_id', [
      'cat-1',
      'cat-child',
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        slug: 'new-product',
        category_slug: 'laptops',
      }),
    ]);
  });

  it('prefers the direct canonical category slug over secondary memberships', async () => {
    productResponses = [
      {
        data: [
          {
            ...canonicalProduct,
            categories: { slug: 'laptops' },
            product_categories: [
              {
                category_id: 'secondary-cat',
                categories: { slug: 'secondary-laptops' },
              },
            ],
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
        category_slug: 'laptops',
      }),
    ]);
  });

  it('prefers scoped current-product rows over unscoped duplicates', async () => {
    productResponses = [
      {
        data: [
          {
            ...canonicalProduct,
            id: 'current-prod',
            slug: 'legion-5',
            category_id: null,
            categories: null,
            product_categories: [
              {
                category_id: 'cat-parent',
                categories: { slug: 'laptops' },
              },
            ],
          },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          {
            ...canonicalProduct,
            id: 'current-prod',
            slug: 'legion-5',
            category_id: null,
            categories: null,
            product_categories: [
              {
                category_id: 'cat-child',
                categories: { slug: 'gaming-laptops' },
              },
            ],
          },
        ],
        error: null,
      },
    ];

    const result = await getProductSeoInventory(
      'merchant-1',
      'gaming-laptops',
      'current-prod'
    );

    expect(result).toEqual([
      expect.objectContaining({
        slug: 'legion-5',
        category_slug: 'gaming-laptops',
      }),
    ]);
  });
});
