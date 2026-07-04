import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductRecord, updateProductRecord } from './product-save';

type RpcCall = { name: string; args: Record<string, unknown> };
type RpcResponse = {
  data: Record<string, unknown> | null;
  error: null | { code?: string; message: string };
};

const mocks = vi.hoisted(() => ({
  assertNoDuplicateProduct: vi.fn(),
  revalidateStorefrontProducts: vi.fn(),
  calls: [] as RpcCall[],
  response: {
    data: null,
    error: null,
  } as RpcResponse,
}));

vi.mock('@baci/shared', () => ({
  inferProductVariantModel: vi.fn(() => 'sku_matrix'),
  normalizeProductVariantModel: vi.fn((value: unknown) => value ?? 'legacy'),
}));

vi.mock('@/lib/product-inventory', () => ({
  normalizeProductInventory: (product: Record<string, unknown>) => ({
    ...product,
    normalized: true,
  }),
}));

vi.mock('@/lib/revalidate-storefront-products', () => ({
  revalidateStorefrontProducts: (...args: unknown[]) =>
    mocks.revalidateStorefrontProducts(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      mocks.calls.push({ args, name });
      return Promise.resolve(mocks.response);
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
  isDuplicateConstraintError: (error: { code?: string; message?: string }) =>
    error.code === '23505' || error.message?.includes('duplicate'),
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
    mocks.revalidateStorefrontProducts.mockReset();
    mocks.calls = [];
    mocks.response = {
      data: {
        id: 'product-1',
        name: 'Ankara Bag',
        slug: 'ankara-bag',
        category: 'Bags',
        variant_model: 'sku_matrix',
      },
      error: null,
    };
  });

  it('creates a product and variants through the atomic save RPC', async () => {
    const product = await createProductRecord({
      merchantId: 'merchant-1',
      newProduct: productForm,
    });

    expect(mocks.assertNoDuplicateProduct).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      productName: 'Ankara Bag',
    });
    expect(mocks.calls).toEqual([
      {
        args: expect.objectContaining({
          p_merchant_id: 'merchant-1',
          p_product_id: null,
          p_product_payload: expect.objectContaining({
            has_variants: true,
            name: 'Ankara Bag',
          }),
          p_variant_model: 'sku_matrix',
          p_variants: productForm.variants,
        }),
        name: 'save_mobile_admin_product_with_variants',
      },
    ]);
    expect(product).toEqual(
      expect.objectContaining({
        id: 'product-1',
        normalized: true,
        variant_model: 'sku_matrix',
      })
    );
  });

  it('updates an existing product with duplicate exclusion through the same RPC', async () => {
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
    expect(mocks.calls[0]).toEqual({
      args: expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_product_id: 'product-1',
      }),
      name: 'save_mobile_admin_product_with_variants',
    });
  });

  it('schedules a storefront purge with the saved product after a successful save', async () => {
    await createProductRecord({
      merchantId: 'merchant-1',
      newProduct: productForm,
    });

    expect(mocks.revalidateStorefrontProducts).toHaveBeenCalledWith([
      { slug: 'ankara-bag', id: 'product-1', category: 'Bags' },
    ]);
  });

  it('adds a hint-only old-category entry when an edit moves the product to a new category', async () => {
    mocks.response = {
      data: {
        id: 'product-1',
        name: 'Ankara Bag',
        slug: 'ankara-bag',
        category: 'Handbags',
        category_id: 'cat-new',
        variant_model: 'sku_matrix',
      },
      error: null,
    };

    await updateProductRecord({
      id: 'product-1',
      merchantId: 'merchant-1',
      updates: productForm,
      previousCategory: 'Bags',
      previousCategoryId: 'cat-old',
    });

    // Primary entry (id-carrying, NEW category) plus a hint-only entry (NO id,
    // OLD category text) so the web purges both the new and old category URLs.
    expect(mocks.revalidateStorefrontProducts).toHaveBeenCalledWith([
      { slug: 'ankara-bag', id: 'product-1', category: 'Handbags' },
      { slug: 'ankara-bag', category: 'Bags' },
    ]);
  });

  it('schedules a single entry when an edit does not change the category', async () => {
    mocks.response = {
      data: {
        id: 'product-1',
        name: 'Ankara Bag',
        slug: 'ankara-bag',
        category: 'Bags',
        category_id: 'cat-old',
        variant_model: 'sku_matrix',
      },
      error: null,
    };

    await updateProductRecord({
      id: 'product-1',
      merchantId: 'merchant-1',
      updates: productForm,
      previousCategory: 'Bags',
      previousCategoryId: 'cat-old',
    });

    expect(mocks.revalidateStorefrontProducts).toHaveBeenCalledWith([
      { slug: 'ankara-bag', id: 'product-1', category: 'Bags' },
    ]);
  });

  it('schedules a single entry for a create (no previous category to purge)', async () => {
    await createProductRecord({
      merchantId: 'merchant-1',
      newProduct: productForm,
    });

    expect(mocks.revalidateStorefrontProducts).toHaveBeenCalledWith([
      { slug: 'ankara-bag', id: 'product-1', category: 'Bags' },
    ]);
    expect(mocks.revalidateStorefrontProducts).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a storefront purge when the save RPC fails', async () => {
    mocks.response = {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique' },
    };

    await expect(
      createProductRecord({
        merchantId: 'merchant-1',
        newProduct: productForm,
      })
    ).rejects.toThrow();

    expect(mocks.revalidateStorefrontProducts).not.toHaveBeenCalled();
  });

  it('maps duplicate RPC errors to the product duplicate message', async () => {
    mocks.response = {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique' },
    };

    await expect(
      createProductRecord({
        merchantId: 'merchant-1',
        newProduct: productForm,
      })
    ).rejects.toThrow('A product with this name already exists');
  });
});
