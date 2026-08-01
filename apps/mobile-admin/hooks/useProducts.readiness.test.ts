import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getUseProductsMocks,
  resetUseProductsMocks,
} from './useProducts.test-setup';

const mocks = getUseProductsMocks();
let useCreateProduct: typeof import('./useProducts').useCreateProduct;
let useUpdateProduct: typeof import('./useProducts').useUpdateProduct;

describe('useProducts readiness mutations', () => {
  beforeAll(async () => {
    ({ useCreateProduct, useUpdateProduct } = await import('./useProducts'));
  });

  beforeEach(resetUseProductsMocks);

  it('invalidates readiness only when a created product is active', async () => {
    useCreateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1', status: 'active' },
      {}
    );

    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
  });

  it('does not invalidate readiness when a created product remains a draft', async () => {
    useCreateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1', status: 'draft' },
      {}
    );

    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('preserves an active product create when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useCreateProduct();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1', status: 'active' },
        {}
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });

  it('co-starts and awaits product-list and readiness refreshes for an active create', async () => {
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    mocks.queryClient.invalidateQueries.mockImplementation(deferred);
    mocks.invalidateStoreReadiness.mockImplementation(deferred);
    useCreateProduct();
    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1', status: 'active' },
        {}
      )
    ).then(() => {
      completed = true;
    });

    expect(releases).toHaveLength(2);
    expect(completed).toBe(false);
    for (const release of releases) release();
    await completion;
    expect(completed).toBe(true);
  });

  it('does not invalidate readiness after a failed product create', async () => {
    mocks.createProductRecord.mockRejectedValueOnce(new Error('Create failed'));
    useCreateProduct();

    await expect(mocks.mutationConfigs[0]?.mutationFn?.({})).rejects.toThrow(
      'Create failed'
    );

    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('invalidates readiness only for a status field update and awaits it with product invalidations', async () => {
    let releaseReadiness!: () => void;
    const readiness = new Promise<void>((resolve) => {
      releaseReadiness = resolve;
    });
    mocks.invalidateStoreReadiness.mockReturnValueOnce(readiness);
    useUpdateProduct();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { updates: { name: 'Renamed product' } }
    );
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();

    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { updates: { status: 'active' } }
      )
    );
    completion.then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
    expect(completed).toBe(false);

    releaseReadiness();
    await completion;
    expect(completed).toBe(true);
  });

  it('preserves a saved product update when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useUpdateProduct();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { updates: { status: 'active' } }
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });
});
