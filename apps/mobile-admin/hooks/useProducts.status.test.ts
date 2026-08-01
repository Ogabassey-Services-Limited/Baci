import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getUseProductsMocks,
  resetUseProductsMocks,
} from './useProducts.test-setup';

const mocks = getUseProductsMocks();
let useUpdateProductStatus: typeof import('./useProducts').useUpdateProductStatus;

describe('useUpdateProductStatus readiness mutations', () => {
  beforeAll(async () => {
    ({ useUpdateProductStatus } = await import('./useProducts'));
  });

  beforeEach(resetUseProductsMocks);

  it('invalidates readiness after a successful product status change', async () => {
    useUpdateProductStatus();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { productId: 'product-1', status: 'active' }
    );

    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
  });

  it('preserves a successful status update when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    useUpdateProductStatus();

    await expect(
      mocks.mutationConfigs[0]?.onSuccess?.(
        { id: 'product-1' },
        { productId: 'product-1', status: 'active' }
      )
    ).resolves.toBeUndefined();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
  });

  it('invalidates product list and detail caches after a persisted status update without merchant context', async () => {
    mocks.merchant = null;
    useUpdateProductStatus();

    await mocks.mutationConfigs[0]?.onSuccess?.(
      { id: 'product-1' },
      { productId: 'product-1', status: 'active' }
    );

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product'],
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('does not invalidate product or readiness queries when a status mutation fails', async () => {
    const failure = new Error('Status update failed');
    mocks.updateProductStatus.mockRejectedValueOnce(failure);
    useUpdateProductStatus();

    await expect(
      mocks.mutationConfigs[0]?.mutationFn?.({
        productId: 'product-1',
        status: 'active',
      })
    ).rejects.toBe(failure);

    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('co-starts and awaits list, detail, and readiness refreshes for an explicit status mutation', async () => {
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => releases.push(resolve));
    mocks.queryClient.invalidateQueries.mockImplementation(deferred);
    mocks.invalidateStoreReadiness.mockImplementation(deferred);
    useUpdateProductStatus();
    let completed = false;
    const completion = Promise.resolve(
      mocks.mutationConfigs[0]?.onSuccess?.(
        {},
        { productId: 'product-1', status: 'active' }
      )
    ).then(() => {
      completed = true;
    });

    expect(releases).toHaveLength(3);
    expect(completed).toBe(false);
    for (const release of releases) release();
    await completion;
    expect(completed).toBe(true);
  });
});
