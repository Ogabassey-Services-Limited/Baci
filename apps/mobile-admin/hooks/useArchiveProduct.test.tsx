import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  merchant: { id: 'merchant-1' } as { id: string } | null,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));

import { archiveProductById, useArchiveProduct } from './useArchiveProduct';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('archiveProductById', () => {
  beforeEach(() => {
    mocks.apiClient.mockReset();
    mocks.invalidateStoreReadiness.mockReset();
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.merchant = { id: 'merchant-1' };
    mocks.apiClient.mockResolvedValue({
      product: { id: 'product 1', status: 'archived' },
      success: true,
    });
  });

  it('calls the permission-checked archive endpoint', async () => {
    await archiveProductById('product 1');

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/products/product%201/archive',
      { method: 'PATCH' }
    );
  });

  it('propagates archive endpoint failures', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('archive failed'));

    await expect(archiveProductById('product-1')).rejects.toThrow(
      'archive failed'
    );
  });
});

describe('useArchiveProduct', () => {
  beforeEach(() => {
    mocks.apiClient.mockReset();
    mocks.invalidateStoreReadiness.mockReset();
    mocks.invalidateStoreReadiness.mockResolvedValue(undefined);
    mocks.merchant = { id: 'merchant-1' };
    mocks.apiClient.mockResolvedValue({
      product: { id: 'product-1', status: 'archived' },
      success: true,
    });
  });

  it('invalidates product and inventory stats queries after archiving', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useArchiveProduct(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ productId: 'product-1' });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
  });

  it('starts all authoritative refreshes together and waits for each after a successful archive', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const releases: Array<() => void> = [];
    const deferred = () =>
      new Promise<void>((resolve) => {
        releases.push(resolve);
      });
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(deferred);
    mocks.invalidateStoreReadiness.mockImplementation(deferred);
    const { result } = renderHook(() => useArchiveProduct(), {
      wrapper: createWrapper(queryClient),
    });

    let completed = false;
    const archive = result.current
      .mutateAsync({ productId: 'product-1' })
      .then(() => {
        completed = true;
      });

    await vi.waitFor(() => {
      expect(releases).toHaveLength(4);
    });
    expect(completed).toBe(false);

    for (const release of releases) release();
    await archive;
    expect(completed).toBe(true);
  });

  it('preserves a successful archive when only readiness refresh fails', async () => {
    mocks.invalidateStoreReadiness.mockRejectedValueOnce(
      new Error('Readiness refresh failed')
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useArchiveProduct(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      result.current.mutateAsync({ productId: 'product-1' })
    ).resolves.toEqual({
      product: { id: 'product-1', status: 'archived' },
      success: true,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
  });

  it('uses the merchant present when archive starts after the context disappears before settlement', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    let releaseArchive: (() => void) | undefined;
    mocks.apiClient.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseArchive = () =>
            resolve({
              product: { id: 'product-1', status: 'archived' },
              success: true,
            });
        })
    );
    const { rerender, result } = renderHook(() => useArchiveProduct(), {
      wrapper: createWrapper(queryClient),
    });

    const archive = result.current.mutateAsync({ productId: 'product-1' });
    await vi.waitFor(() => expect(releaseArchive).toBeTypeOf('function'));
    mocks.merchant = null;
    rerender();
    if (!releaseArchive) {
      throw new Error('Archive request did not start');
    }
    releaseArchive();

    await expect(archive).resolves.toEqual({
      product: { id: 'product-1', status: 'archived' },
      success: true,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      queryClient,
      'merchant-1'
    );
  });

  it('surfaces errors and still settles product query invalidation', async () => {
    mocks.apiClient.mockRejectedValueOnce(new Error('archive failed'));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useArchiveProduct(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ productId: 'product-1' })
      ).rejects.toThrow('archive failed');
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });
});
