import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { saveDirtyProducts } from './save-dirty-products';

const baseProduct: Product = {
  id: 'product-1',
  name: 'Test Product',
  description: '',
  price: 1000,
  stock: 5,
  minimum_order_quantity: 1,
  status: 'active',
  image: '',
  imageLarge: '',
};

describe('saveDirtyProducts', () => {
  it('returns fulfilled ids for products saved successfully', async () => {
    const updateProduct = vi.fn().mockResolvedValue(undefined);

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-1'],
      localProducts: [baseProduct],
      updateProduct,
    });

    expect(updateProduct).toHaveBeenCalledWith(baseProduct);
    expect(result).toEqual({
      failedIds: [],
      fulfilledIds: ['product-1'],
      skippedIds: [],
    });
  });

  it('keeps failed ids separate from fulfilled ids', async () => {
    const updateProduct = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('save failed'));

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-1', 'product-2'],
      localProducts: [
        baseProduct,
        { ...baseProduct, id: 'product-2', name: 'Second Product' },
      ],
      updateProduct,
    });

    expect(result).toEqual({
      failedIds: ['product-2'],
      fulfilledIds: ['product-1'],
      skippedIds: [],
    });
  });

  it('skips dirty ids that are no longer present in local products', async () => {
    const updateProduct = vi.fn().mockResolvedValue(undefined);

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-1', 'missing-product'],
      localProducts: [baseProduct],
      updateProduct,
    });

    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      failedIds: [],
      fulfilledIds: ['product-1'],
      skippedIds: ['missing-product'],
    });
  });
});
