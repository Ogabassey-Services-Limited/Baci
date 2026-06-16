import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  normalizeProductInventory: vi.fn((product: unknown) => product),
}));

type ProductsQueryResult = {
  count: number | null;
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

type ProductsQuery = Promise<ProductsQueryResult> & {
  eq: (column: string, value: unknown) => ProductsQuery;
  gt: (column: string, value: unknown) => ProductsQuery;
  is: (column: string, value: unknown) => ProductsQuery;
  lte: (column: string, value: unknown) => ProductsQuery;
  order: (column: string, options: unknown) => ProductsQuery;
  range: (from: number, to: number) => ProductsQuery;
  select: (columns: string, options?: unknown) => ProductsQuery;
};

function createProductsQuery(result: ProductsQueryResult): ProductsQuery {
  const query = Promise.resolve(result) as ProductsQuery;
  query.eq = vi.fn(() => query) as ProductsQuery['eq'];
  query.gt = vi.fn(() => query) as ProductsQuery['gt'];
  query.is = vi.fn(() => query) as ProductsQuery['is'];
  query.lte = vi.fn(() => query) as ProductsQuery['lte'];
  query.order = vi.fn(() => query) as ProductsQuery['order'];
  query.range = vi.fn(() => query) as ProductsQuery['range'];
  query.select = vi.fn(() => query) as ProductsQuery['select'];
  return query;
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/product-inventory', () => ({
  normalizeProductInventory: mocks.normalizeProductInventory,
}));

vi.mock('@/lib/product-search', () => ({
  fetchAdminProductSearchRows: vi.fn(),
}));

import { fetchProducts } from './products-data';

describe('fetchProducts stock filters', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.normalizeProductInventory.mockClear();
  });

  it('restricts out-of-stock results to managed inventory', async () => {
    const query = createProductsQuery({ count: 0, data: [], error: null });
    mocks.from.mockReturnValueOnce(query);

    await fetchProducts('merchant-1', 0, { stockFilter: 'out_of_stock' });

    expect(query.eq).toHaveBeenCalledWith('manage_stock', true);
    expect(query.lte).toHaveBeenCalledWith('stock_quantity', 0);
  });

  it('restricts low-stock results to managed inventory above zero and at threshold', async () => {
    const query = createProductsQuery({ count: 0, data: [], error: null });
    mocks.from.mockReturnValueOnce(query);

    await fetchProducts('merchant-1', 0, { stockFilter: 'low_stock' });

    expect(query.eq).toHaveBeenCalledWith('manage_stock', true);
    expect(query.gt).toHaveBeenCalledWith('stock_quantity', 0);
    expect(query.lte).toHaveBeenCalledWith('stock_quantity', 5);
  });

  it('excludes untracked inventory from in-stock management results', async () => {
    const row = { id: 'product-1', name: 'Phone', stock_quantity: 3 };
    const normalized = { id: 'product-1', name: 'Phone', stock: 3 };
    mocks.normalizeProductInventory.mockReturnValueOnce(normalized);
    const query = createProductsQuery({ count: 1, data: [row], error: null });
    mocks.from.mockReturnValueOnce(query);

    await expect(
      fetchProducts('merchant-1', 0, { stockFilter: 'in_stock' })
    ).resolves.toEqual({
      nextCursor: null,
      products: [normalized],
      totalCount: 1,
    });

    expect(query.eq).toHaveBeenCalledWith('manage_stock', true);
    expect(query.gt).toHaveBeenCalledWith('stock_quantity', 0);
    expect(mocks.normalizeProductInventory).toHaveBeenCalledWith(row);
  });

  it.each([
    'out_of_stock',
    'low_stock',
    'in_stock',
  ] as const)('throws query errors for %s stock filter', async (stockFilter) => {
    const query = createProductsQuery({
      count: null,
      data: null,
      error: { message: 'products failed' },
    });
    mocks.from.mockReturnValueOnce(query);

    await expect(
      fetchProducts('merchant-1', 0, { stockFilter })
    ).rejects.toThrow('products failed');
  });
});
