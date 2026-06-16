import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationConfig } from '@/test-utils/mutation-mocks';

const mocks = vi.hoisted(() => ({
  merchantId: 'merchant-1' as string | null,
  mutationConfig: null as MutationConfig | null,
  queryClient: { invalidateQueries: vi.fn() },
  rpc: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    mocks.mutationConfig = config;
    return {
      mutateAsync: (variables: unknown) =>
        config.mutationFn(variables).then((data) => {
          config.onSuccess?.(data, variables, undefined, undefined);
          return data;
        }),
    };
  },
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

import { useRestockVariantInventory } from './useRestockVariantInventory';

describe('useRestockVariantInventory', () => {
  beforeEach(() => {
    mocks.merchantId = 'merchant-1';
    mocks.mutationConfig = null;
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.rpc.mockReset();
  });

  it('restocks units and invalidates product inventory queries', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { productId: 'product-1', success: true },
      error: null,
    });

    const mutation = useRestockVariantInventory();
    await mutation.mutateAsync({
      branchId: 'branch-1',
      inventoryTrackingPolicy: 'serialized_strict',
      productId: 'product-1',
      units: [{ imei: '123456789012345', source: 'merchant_stock' }],
      variantId: 'variant-1',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('restock_variant_inventory_units', {
      p_branch_id: 'branch-1',
      p_inventory_tracking_policy: 'serialized_strict',
      p_merchant_id: 'merchant-1',
      p_product_id: 'product-1',
      p_units: [{ imei: '123456789012345', source: 'merchant_stock' }],
      p_variant_id: 'variant-1',
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
  });

  it('rejects before RPC when merchant is missing', async () => {
    mocks.merchantId = null;
    const mutation = useRestockVariantInventory();

    await expect(
      mutation.mutateAsync({ productId: 'product-1', units: [] })
    ).rejects.toThrow('No merchant');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors through inventory mutation errors', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'bad unit' },
    });
    const mutation = useRestockVariantInventory();

    await expect(
      mutation.mutateAsync({ productId: 'product-1', units: [] })
    ).rejects.toMatchObject({ message: 'bad unit' });
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
