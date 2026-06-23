import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CartItem } from '@/stores/cart-store';

type ProductsResponse = {
  data: Array<{ id: string; price: number | string }> | null;
  error: { message: string } | null;
};

type VariantsResponse = {
  data: Array<{
    id: string;
    product_id: string;
    price_override: number | string | null;
  }> | null;
  error: { message: string } | null;
};

type ProductQuery = {
  select: jest.MockedFunction<(columns: string) => ProductQuery>;
  eq: jest.MockedFunction<(column: string, value: unknown) => ProductQuery>;
  in: jest.MockedFunction<
    (column: string, values: string[]) => Promise<ProductsResponse>
  >;
};

const mockWarn = jest.fn();
const mockRpc =
  jest.fn<
    (
      name: string,
      params: { p_variant_ids: string[] }
    ) => Promise<VariantsResponse>
  >();
const productQuery = {} as ProductQuery;
const mockFrom = jest.fn(() => productQuery);

async function repriceCartItems(
  ...args: Parameters<typeof import('./cart-reprice').repriceCartItems>
) {
  const repriceModule = await import('./cart-reprice');
  return repriceModule.repriceCartItems(...args);
}

productQuery.select = jest.fn(() => productQuery);
productQuery.eq = jest.fn(() => productQuery);
productQuery.in = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: mockWarn,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

function createCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'line-1',
    product_id: 'product-1',
    slug: 'iphone-13',
    name: 'iPhone 13',
    price: 390000,
    quantity: 1,
    ...overrides,
  };
}

describe('repriceCartItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productQuery.select.mockClear();
    productQuery.eq.mockClear();
    productQuery.in.mockReset();
    mockRpc.mockReset();
    productQuery.in.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  it('skips catalog reads when the merchant scope is missing', async () => {
    const result = await repriceCartItems([createCartItem()], '');

    expect(result).toEqual({ priceById: {}, changes: [] });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('skips catalog reads when the cart is empty even with a valid merchant', async () => {
    const result = await repriceCartItems([], 'merchant-1');

    expect(result).toEqual({ priceById: {}, changes: [] });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('uses live product prices and variant overrides as authoritative unit prices', async () => {
    const items = [
      createCartItem({ id: 'base-line', product_id: 'base-product' }),
      createCartItem({
        id: 'variant-line',
        product_id: 'variant-product',
        variant_id: 'variant-1',
        name: 'Galaxy A27 8GB',
        price: 420000,
      }),
    ];
    productQuery.in.mockResolvedValue({
      data: [
        { id: 'base-product', price: '410000' },
        { id: 'variant-product', price: 450000 },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'variant-1',
          product_id: 'variant-product',
          price_override: '475000',
        },
      ],
      error: null,
    });

    const result = await repriceCartItems(items, 'merchant-1');

    expect(mockFrom).toHaveBeenCalledWith('products');
    expect(productQuery.select).toHaveBeenCalledWith('id, price');
    expect(productQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(productQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(productQuery.in).toHaveBeenCalledWith('id', [
      'base-product',
      'variant-product',
    ]);
    expect(mockRpc).toHaveBeenCalledWith('get_order_variant_overrides', {
      p_variant_ids: ['variant-1'],
    });
    expect(result.priceById).toEqual({
      'base-line': 410000,
      'variant-line': 475000,
    });
    expect(result.changes).toEqual([
      {
        id: 'base-line',
        name: 'iPhone 13',
        oldPrice: 390000,
        newPrice: 410000,
      },
      {
        id: 'variant-line',
        name: 'Galaxy A27 8GB',
        oldPrice: 420000,
        newPrice: 475000,
      },
    ]);
  });

  it('does not report a price change within the one-naira tolerance', async () => {
    productQuery.in.mockResolvedValue({
      data: [{ id: 'product-1', price: 390001 }],
      error: null,
    });

    const result = await repriceCartItems([createCartItem()], 'merchant-1');

    expect(result.priceById).toEqual({ 'line-1': 390001 });
    expect(result.changes).toEqual([]);
  });

  it('fails open when product lookup fails', async () => {
    productQuery.in.mockResolvedValue({
      data: null,
      error: { message: 'products unavailable' },
    });

    const result = await repriceCartItems([createCartItem()], 'merchant-1');

    expect(result).toEqual({ priceById: {}, changes: [] });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      'Reprice products lookup failed; keeping cart prices',
      { error: 'products unavailable' }
    );
  });

  it('falls back to base product prices when variant lookup fails', async () => {
    const item = createCartItem({
      variant_id: 'variant-1',
      price: 390000,
    });
    productQuery.in.mockResolvedValue({
      data: [{ id: 'product-1', price: 430000 }],
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'variants unavailable' },
    });

    const result = await repriceCartItems([item], 'merchant-1');

    expect(result.priceById).toEqual({ 'line-1': 430000 });
    expect(result.changes).toEqual([
      {
        id: 'line-1',
        name: 'iPhone 13',
        oldPrice: 390000,
        newPrice: 430000,
      },
    ]);
    expect(mockWarn).toHaveBeenCalledWith(
      'Reprice variant override lookup failed; using base prices',
      { error: 'variants unavailable' }
    );
  });
});
