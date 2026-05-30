import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductRecord, updateProductRecord } from './product-save';

type QueryCall = { method: string; args: unknown[] };
type QueryResponse = {
  data: Record<string, unknown> | null;
  error: null | { message: string };
};

const mocks = vi.hoisted(() => ({
  assertNoDuplicateProduct: vi.fn(),
  calls: [] as QueryCall[],
  responses: [] as QueryResponse[],
  syncStructuredVariants: vi.fn(),
}));

vi.mock('@baci/shared', () => ({
  inferProductVariantModel: vi.fn(() => 'sku_matrix'),
  MOBILE_ADMIN_PRODUCT_COLUMNS: 'id, name, variant_model',
  normalizeProductVariantModel: vi.fn((value: unknown) => value ?? 'legacy'),
}));

vi.mock('@/lib/product-inventory', () => ({
  normalizeProductInventory: (product: Record<string, unknown>) => ({
    ...product,
    normalized: true,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        delete: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.delete` });
          return query;
        },
        eq: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.eq` });
          return query;
        },
        insert: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.insert` });
          return query;
        },
        select: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.select` });
          return query;
        },
        single: () =>
          Promise.resolve(
            mocks.responses.shift() ?? { data: null, error: null }
          ),
        update: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.update` });
          return query;
        },
      };
      return query;
    },
  },
}));

vi.mock('@/lib/validators/product', () => ({
  ProductDbSchema: {
    parse: (value: unknown) => value,
  },
}));

vi.mock('./product-duplicate', () => ({
  assertNoDuplicateProduct: (
    params: Parameters<typeof mocks.assertNoDuplicateProduct>[0]
  ) => mocks.assertNoDuplicateProduct(params),
  DUPLICATE_PRODUCT_ERROR: 'A product with this name already exists',
  isDuplicateConstraintError: () => false,
}));

vi.mock('./product-variant-sync', () => ({
  syncStructuredVariants: (
    params: Parameters<typeof mocks.syncStructuredVariants>[0]
  ) => mocks.syncStructuredVariants(params),
}));

const productForm = {
  brand: undefined,
  category_id: '',
  color: undefined,
  condition: null,
  cost_price: 8000,
  description: undefined,
  has_variants: true,
  images: [],
  low_stock_threshold: undefined,
  manage_stock: true,
  migration_status: 'pending',
  name: 'Ankara Bag',
  price: 12000,
  sku: 'ANK-BAG',
  status: 'active' as const,
  stock_quantity: 4,
  variant_attributes: [],
  variant_model: 'sku_matrix',
  variants: [
    {
      attributes: [{ key: 'Color', value: 'Blue' }],
      condition: null,
      cost_price: 8000,
      images: [],
      price: 12000,
      sku: 'ANK-BLU',
      stock_quantity: 4,
    },
  ],
};

describe('product save helpers', () => {
  beforeEach(() => {
    mocks.assertNoDuplicateProduct.mockReset();
    mocks.calls = [];
    mocks.responses = [];
    mocks.syncStructuredVariants.mockReset();
  });

  it('creates a product, syncs variants, and persists the inferred variant model', async () => {
    mocks.responses = [
      { data: { id: 'product-1', name: 'Ankara Bag' }, error: null },
      {
        data: {
          id: 'product-1',
          name: 'Ankara Bag',
          variant_model: 'sku_matrix',
        },
        error: null,
      },
    ];

    const product = await createProductRecord({
      merchantId: 'merchant-1',
      newProduct: productForm,
    });

    expect(mocks.assertNoDuplicateProduct).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      productName: 'Ankara Bag',
    });
    expect(mocks.syncStructuredVariants).toHaveBeenCalledWith({
      hasVariants: true,
      merchantId: 'merchant-1',
      productId: 'product-1',
      variants: productForm.variants,
    });
    expect(mocks.calls).toContainEqual({
      args: [[expect.objectContaining({ merchant_id: 'merchant-1' })]],
      method: 'products.insert',
    });
    expect(product).toEqual(
      expect.objectContaining({
        id: 'product-1',
        normalized: true,
        variant_model: 'sku_matrix',
      })
    );
  });

  it('rolls back a newly inserted product when variant sync fails', async () => {
    const syncError = new Error('variant sync failed');
    mocks.responses = [
      { data: { id: 'product-1', name: 'Ankara Bag' }, error: null },
    ];
    mocks.syncStructuredVariants.mockRejectedValueOnce(syncError);

    await expect(
      createProductRecord({
        merchantId: 'merchant-1',
        newProduct: productForm,
      })
    ).rejects.toBe(syncError);

    expect(mocks.calls).toContainEqual({
      args: [],
      method: 'products.delete',
    });
    expect(mocks.calls).toContainEqual({
      args: ['id', 'product-1'],
      method: 'products.eq',
    });
  });

  it('updates an existing product with duplicate exclusion and variant sync', async () => {
    mocks.responses = [
      { data: { id: 'product-1', name: 'Ankara Bag' }, error: null },
      {
        data: {
          id: 'product-1',
          name: 'Ankara Bag',
          variant_model: 'sku_matrix',
        },
        error: null,
      },
    ];

    await updateProductRecord({
      id: 'product-1',
      merchantId: 'merchant-1',
      updates: productForm,
    });

    expect(mocks.assertNoDuplicateProduct).toHaveBeenCalledWith({
      excludeProductId: 'product-1',
      merchantId: 'merchant-1',
      productName: 'Ankara Bag',
    });
    expect(mocks.syncStructuredVariants).toHaveBeenCalledWith({
      hasVariants: true,
      merchantId: 'merchant-1',
      productId: 'product-1',
      variants: productForm.variants,
    });
  });
});
