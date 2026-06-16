import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationConfig } from '@/test-utils/mutation-mocks';

const mocks = vi.hoisted(() => ({
  merchantId: 'merchant-1' as string | null,
  queryClient: { invalidateQueries: vi.fn() },
  rpc: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => ({
    mutateAsync: (variables: unknown) =>
      config.mutationFn(variables).then((data) => {
        config.onSuccess?.(data, variables, undefined, undefined);
        return data;
      }),
  }),
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: mocks.merchantId ? { id: mocks.merchantId } : null,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

import { useDeleteVariantInventoryUnit } from './useDeleteVariantInventoryUnit';

describe('useDeleteVariantInventoryUnit', () => {
  beforeEach(() => {
    mocks.merchantId = 'merchant-1';
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.rpc.mockReset();
  });

  it('deletes a unit and invalidates product inventory queries', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { productId: 'product-1', success: true },
      error: null,
    });

    const mutation = useDeleteVariantInventoryUnit();
    await mutation.mutateAsync({ productId: 'product-1', unitId: 'unit-1' });

    expect(mocks.rpc).toHaveBeenCalledWith('delete_variant_inventory_unit', {
      p_merchant_id: 'merchant-1',
      p_unit_id: 'unit-1',
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
  });

  it('rejects before RPC when merchant is missing', async () => {
    mocks.merchantId = null;
    const mutation = useDeleteVariantInventoryUnit();

    await expect(
      mutation.mutateAsync({ productId: 'product-1', unitId: 'unit-1' })
    ).rejects.toThrow('No merchant');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors through inventory mutation errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'delete failed' },
    });
    const mutation = useDeleteVariantInventoryUnit();

    await expect(
      mutation.mutateAsync({ productId: 'product-1', unitId: 'unit-1' })
    ).rejects.toMatchObject({ message: 'delete failed' });
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
