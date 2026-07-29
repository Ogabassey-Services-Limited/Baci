import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mocks.apiClient(...args),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
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
    vi.clearAllMocks();
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
    vi.clearAllMocks();
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
