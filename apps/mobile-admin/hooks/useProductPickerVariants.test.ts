import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildStructuredVariantPickerItems: vi.fn(() => [{ id: 'variant-1' }]),
  from: vi.fn(),
}));

type ProductVariantQueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};

function createProductVariantQuery(result: ProductVariantQueryResult) {
  let eqCalls = 0;
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockImplementation(() => {
    eqCalls += 1;
    return eqCalls >= 3 ? Promise.resolve(result) : query;
  });
  return query;
}

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('@/lib/product-picker-variant-rows', () => ({
  buildStructuredVariantPickerItems: mocks.buildStructuredVariantPickerItems,
}));

import { fetchAdminProductVariants } from './useProductPickerVariants';

describe('fetchAdminProductVariants', () => {
  beforeEach(() => {
    mocks.buildStructuredVariantPickerItems.mockClear();
    mocks.from.mockReset();
  });

  it('loads non-anchor structured variant rows with scoped query parameters', async () => {
    const rows = [
      {
        id: 'variant-1',
        attributes: { color: 'black' },
        condition: 'new',
        cost_price: 80,
        images: ['image.jpg'],
        price_override: 120,
        primary_image: 'image.jpg',
        sku: 'SKU-1',
      },
    ];
    const query = createProductVariantQuery({ data: rows, error: null });
    mocks.from.mockReturnValueOnce(query);

    const result = await fetchAdminProductVariants({
      merchantId: 'merchant-1',
      parentProduct: {
        id: 'product-1',
        name: 'Phone',
        price: 100,
      },
    });

    expect(result).toEqual([{ id: 'variant-1' }]);
    expect(mocks.from).toHaveBeenCalledWith('product_variants');
    expect(query.select).toHaveBeenCalledWith(
      'id, attributes, condition, cost_price, images, price_override, primary_image, sku, stock_quantity'
    );
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('product_id', 'product-1');
    expect(query.eq).toHaveBeenCalledWith('is_inventory_anchor', false);
    expect(mocks.buildStructuredVariantPickerItems).toHaveBeenCalledWith({
      parentProduct: {
        id: 'product-1',
        name: 'Phone',
        price: 100,
      },
      parentProductId: 'product-1',
      variants: rows,
    });
  });

  it('throws the Supabase error message when variant loading fails', async () => {
    const query = createProductVariantQuery({
      data: null,
      error: { message: 'query failed' },
    });
    mocks.from.mockReturnValueOnce(query);

    await expect(
      fetchAdminProductVariants({
        merchantId: 'merchant-1',
        parentProduct: {
          id: 'product-1',
          name: 'Phone',
          price: 100,
        },
      })
    ).rejects.toThrow('query failed');
  });
});
