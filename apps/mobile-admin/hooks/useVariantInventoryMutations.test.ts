import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationConfig = {
  mutationFn: (variables: unknown) => Promise<unknown>;
  onSuccess?: (
    data: unknown,
    variables: unknown,
    onMutateResult: unknown,
    context: unknown
  ) => unknown;
};

const mocks = vi.hoisted(() => ({
  mutationConfigs: [] as MutationConfig[],
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  rpc: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    mocks.mutationConfigs.push(config);
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
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import {
  useDeleteVariantInventoryUnit,
  useRestockVariantInventory,
  useUpdateInventoryTrackingPolicy,
  useUpdateVariantInventoryUnit,
} from './useVariantInventory';

describe('useVariantInventoryMutations', () => {
  beforeEach(() => {
    mocks.mutationConfigs.length = 0;
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.rpc.mockReset();
  });

  it('restocks serialized inventory and invalidates product inventory queries', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        productId: 'product-1',
        restockedCount: 1,
        success: true,
        unitIds: ['unit-1'],
        variantId: 'variant-1',
      },
      error: null,
    });

    const mutation = useRestockVariantInventory();
    await mutation.mutateAsync({
      branchId: 'branch-1',
      productId: 'product-1',
      units: [{ imei: '123456789012345', source: 'merchant_stock' }],
      variantId: 'variant-1',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('restock_variant_inventory_units', {
      p_branch_id: 'branch-1',
      p_inventory_tracking_policy: null,
      p_merchant_id: 'merchant-1',
      p_product_id: 'product-1',
      p_units: [{ imei: '123456789012345', source: 'merchant_stock' }],
      p_variant_id: 'variant-1',
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['inventory-stats', 'merchant-1'],
    });
  });

  it('surfaces restock RPC failures', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'restock failed' },
    });

    const mutation = useRestockVariantInventory();

    await expect(
      mutation.mutateAsync({
        productId: 'product-1',
        units: [{ serial: 'SERIAL-1', source: 'merchant_stock' }],
        variantId: null,
      })
    ).rejects.toMatchObject({ message: 'restock failed' });
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('updates a serialized inventory unit and invalidates product inventory queries', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const mutation = useUpdateVariantInventoryUnit();
    await mutation.mutateAsync({
      branchId: 'branch-1',
      identifierValue: 'SERIAL-2',
      notes: 'checked',
      productId: 'product-1',
      setBranch: true,
      status: 'available',
      unitId: 'unit-1',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('update_variant_inventory_unit', {
      p_branch_id: 'branch-1',
      p_identifier_value: 'SERIAL-2',
      p_merchant_id: 'merchant-1',
      p_notes: 'checked',
      p_set_branch: true,
      p_status: 'available',
      p_unit_id: 'unit-1',
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
  });

  it('surfaces serialized inventory unit update RPC failures', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'update failed' },
    });

    const mutation = useUpdateVariantInventoryUnit();

    await expect(
      mutation.mutateAsync({
        productId: 'product-1',
        status: 'defective',
        unitId: 'unit-1',
      })
    ).rejects.toMatchObject({ message: 'update failed' });
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('surfaces delete RPC failures', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'delete failed' },
    });

    const mutation = useDeleteVariantInventoryUnit();

    await expect(
      mutation.mutateAsync({ productId: 'product-1', unitId: 'unit-1' })
    ).rejects.toMatchObject({ message: 'delete failed' });
  });

  it('deletes a serialized inventory unit and invalidates product inventory queries', async () => {
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

  it('updates inventory tracking policy and invalidates product inventory queries', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const mutation = useUpdateInventoryTrackingPolicy();
    await mutation.mutateAsync({
      inventoryTrackingPolicy: 'serialized_strict',
      productId: 'product-1',
      variantId: 'variant-1',
    });

    expect(mocks.rpc).toHaveBeenCalledWith('update_inventory_tracking_policy', {
      p_inventory_tracking_policy: 'serialized_strict',
      p_merchant_id: 'merchant-1',
      p_product_id: 'product-1',
      p_variant_id: 'variant-1',
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['product', 'merchant-1', 'product-1'],
    });
  });

  it('surfaces inventory tracking policy update RPC failures', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'policy failed' },
    });

    const mutation = useUpdateInventoryTrackingPolicy();

    await expect(
      mutation.mutateAsync({
        inventoryTrackingPolicy: 'off',
        productId: 'product-1',
      })
    ).rejects.toMatchObject({ message: 'policy failed' });
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
