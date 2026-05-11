import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { saveDirtyProducts } from './save-dirty-products';

const baseProduct: Product = {
  id: 'product-1',
  name: 'Test Product',
  description: '',
  price: 1000,
  manage_stock: true,
  stock: 5,
  minimum_order_quantity: 1,
  status: 'active',
  image: '',
  imageLarge: '',
  imageHint: 'test product',
  brand: 'Baci',
  gtin: '1234567890123',
  mpn: 'TEST-PRODUCT',
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

  it('saves dirty ids from preserved snapshots when they leave the current page', async () => {
    const updateProduct = vi.fn().mockResolvedValue(undefined);
    const offPageProduct = {
      ...baseProduct,
      id: 'product-2',
      name: 'Off Page Product',
      price: 1500,
    };

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-2'],
      dirtyProductSnapshots: new Map([[offPageProduct.id, offPageProduct]]),
      localProducts: [baseProduct],
      updateProduct,
    });

    expect(updateProduct).toHaveBeenCalledWith(offPageProduct);
    expect(result).toEqual({
      failedIds: [],
      fulfilledIds: ['product-2'],
      skippedIds: [],
    });
  });

  it('returns an empty result when the signal is already aborted', async () => {
    const updateProduct = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    controller.abort();

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-1'],
      localProducts: [baseProduct],
      signal: controller.signal,
      updateProduct,
    });

    expect(updateProduct).not.toHaveBeenCalled();
    expect(result).toEqual({
      failedIds: [],
      fulfilledIds: [],
      skippedIds: [],
    });
  });

  it('stops mid-batch when the signal aborts during execution', async () => {
    const controller = new AbortController();
    const updateProduct = vi.fn().mockImplementation(() => {
      // Simulate the signal being aborted after the first save kicks off.
      controller.abort();
      return Promise.resolve();
    });

    const secondProduct = {
      ...baseProduct,
      id: 'product-2',
      name: 'Second Product',
    };
    const thirdProduct = {
      ...baseProduct,
      id: 'product-3',
      name: 'Third Product',
    };

    const result = await saveDirtyProducts({
      dirtyProductIds: ['product-1', 'product-2', 'product-3'],
      localProducts: [baseProduct, secondProduct, thirdProduct],
      signal: controller.signal,
      updateProduct,
    });

    // Promise.allSettled schedules entries sequentially on the microtask
    // queue, so the abort fired inside the first updateProduct call should
    // prevent subsequent dispatches.
    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(updateProduct).toHaveBeenCalledWith(baseProduct);
    expect(result).toEqual({
      failedIds: [],
      fulfilledIds: [],
      skippedIds: [],
    });
  });
});
