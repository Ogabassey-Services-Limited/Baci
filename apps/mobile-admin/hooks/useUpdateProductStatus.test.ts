import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateStoreReadiness: vi.fn().mockResolvedValue(undefined),
  merchant: { id: 'merchant-1' } as { id: string } | null,
  mutationConfigs: [] as Array<{
    onMutate?: (variables: unknown) => unknown;
    onSuccess?: (
      data: unknown,
      variables: { productId: string; status: string },
      context?: unknown
    ) => unknown;
  }>,
  queryClient: { invalidateQueries: vi.fn() },
  updateProductStatus: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: {
    onMutate?: (variables: unknown) => unknown;
    onSuccess?: (
      data: unknown,
      variables: { productId: string; status: string },
      context?: unknown
    ) => unknown;
  }) => {
    mocks.mutationConfigs.push(config);
    return {};
  },
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/lib/invalidate-store-readiness', () => ({
  invalidateStoreReadiness: mocks.invalidateStoreReadiness,
}));

vi.mock('@/lib/try-refresh-store-readiness', () => ({
  tryRefreshStoreReadiness: (refresh: () => Promise<unknown>) => refresh(),
}));

vi.mock('./products-data', () => ({
  updateProductStatus: mocks.updateProductStatus,
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

import { useUpdateProductStatus } from './useUpdateProductStatus';

describe('useUpdateProductStatus', () => {
  beforeEach(() => {
    mocks.invalidateStoreReadiness.mockClear();
    mocks.merchant = { id: 'merchant-1' };
    mocks.mutationConfigs.length = 0;
    mocks.queryClient.invalidateQueries.mockClear();
  });

  it('keeps a pending status mutation scoped to its originating merchant after a merchant switch', async () => {
    useUpdateProductStatus();
    const pendingMutation = mocks.mutationConfigs[0];
    const variables = { productId: 'product-1', status: 'active' };
    const context = await pendingMutation?.onMutate?.(variables);

    mocks.merchant = { id: 'merchant-2' };
    useUpdateProductStatus();
    await mocks.mutationConfigs[1]?.onSuccess?.({}, variables, context);

    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products', 'merchant-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.invalidateStoreReadiness).toHaveBeenCalledWith(
      mocks.queryClient,
      'merchant-1'
    );
  });
});
