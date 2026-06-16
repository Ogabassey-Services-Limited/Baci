import { beforeEach, describe, expect, it, vi } from 'vitest';

type InfiniteQueryConfig = {
  queryFn: (args: { pageParam?: unknown }) => Promise<unknown>;
  queryKey: readonly unknown[];
  initialPageParam?: unknown;
  getNextPageParam?: (lastPage: { nextCursor?: unknown }) => unknown;
};

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
  rpc: vi.fn(),
  infiniteQueryConfigs: [] as InfiniteQueryConfig[],
  mutationConfigs: [] as MutationConfig[],
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  queryPromises: [] as Promise<unknown>[],
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (config: InfiniteQueryConfig) => {
    mocks.infiniteQueryConfigs.push(config);
    mocks.queryPromises.push(config.queryFn({ pageParam: null }));
    return { data: null, isLoading: false };
  },
  useMutation: (config: MutationConfig) => {
    mocks.mutationConfigs.push(config);
    return {
      mutateAsync: (variables: unknown) =>
        config.mutationFn(variables).then((data: unknown) => {
          if (config.onSuccess) {
            config.onSuccess(data, variables, undefined, undefined);
          }
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
  useVariantInventory,
} from './useVariantInventory';

describe('useVariantInventory hooks', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.infiniteQueryConfigs.length = 0;
    mocks.mutationConfigs.length = 0;
    mocks.queryPromises.length = 0;
    mocks.queryClient.invalidateQueries.mockReset();
  });

  describe('useVariantInventory query', () => {
    it('calls list_variant_inventory_units with filters and handles page data', async () => {
      const mockResult = {
        units: [
          {
            id: 'unit-1',
            identifier_value: '123456789012345',
            identifier_type: 'imei',
            status: 'available',
          },
        ],
        nextCursor: { created_at: '2026-06-15T00:00:00Z', id: 'unit-1' },
        hasMore: true,
      };

      mocks.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const filters = {
        productId: 'product-1',
        variantId: 'variant-1',
        status: 'available',
        branchScope: 'all',
        branchId: 'branch-1',
        limit: 10,
      };

      useVariantInventory(filters);

      expect(mocks.infiniteQueryConfigs.length).toBe(1);
      expect(mocks.infiniteQueryConfigs[0].queryKey).toEqual([
        'variant-inventory',
        'merchant-1',
        filters,
      ]);

      const page = await mocks.queryPromises[0];
      expect(mocks.rpc).toHaveBeenCalledWith('list_variant_inventory_units', {
        p_merchant_id: 'merchant-1',
        p_product_id: 'product-1',
        p_variant_id: 'variant-1',
        p_status: 'available',
        p_branch_scope: 'all',
        p_branch_id: 'branch-1',
        p_limit: 10,
        p_cursor_created_at: null,
        p_cursor_id: null,
      });

      expect(page).toEqual({
        units: mockResult.units,
        nextCursor: mockResult.nextCursor,
        hasMore: true,
      });

      // Test getNextPageParam
      const getNext = mocks.infiniteQueryConfigs[0].getNextPageParam;
      expect(getNext?.(mockResult)).toEqual(mockResult.nextCursor);
    });

    it('throws error if supabase rpc returns error', async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database failure' },
      });

      useVariantInventory({ productId: 'product-1' });

      await expect(mocks.queryPromises[0]).rejects.toThrow('Database failure');
    });
  });

  describe('useRestockVariantInventory mutation', () => {
    it('calls restock_variant_inventory_units and invalidates queries on success', async () => {
      const mockResult = {
        success: true,
        productId: 'product-1',
        variantId: 'variant-1',
        restockedCount: 2,
        unitIds: ['unit-1', 'unit-2'],
      };

      mocks.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const restock = useRestockVariantInventory();
      const payload = {
        productId: 'product-1',
        units: [
          { imei: '123456789012345', source: 'merchant_stock' as const },
          { serial: 'SN12345', source: 'merchant_stock' as const },
        ],
        variantId: 'variant-1',
        inventoryTrackingPolicy: 'serialized_strict' as const,
        branchId: 'branch-1',
      };

      const result = await restock.mutateAsync(payload);

      expect(mocks.rpc).toHaveBeenCalledWith(
        'restock_variant_inventory_units',
        {
          p_merchant_id: 'merchant-1',
          p_product_id: 'product-1',
          p_units: payload.units,
          p_variant_id: 'variant-1',
          p_inventory_tracking_policy: 'serialized_strict',
          p_branch_id: 'branch-1',
        }
      );

      expect(result).toEqual(mockResult);

      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['variant-inventory', 'merchant-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['products', 'merchant-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['product', 'merchant-1', 'product-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['inventory-stats', 'merchant-1'],
      });
    });

    it('throws error if rpc fails', async () => {
      mocks.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Restock failed' },
      });

      const restock = useRestockVariantInventory();
      await expect(
        restock.mutateAsync({
          productId: 'product-1',
          units: [],
        })
      ).rejects.toThrow('Restock failed');
    });
  });

  describe('useUpdateVariantInventoryUnit mutation', () => {
    it('calls update_variant_inventory_unit and invalidates queries on success', async () => {
      mocks.rpc.mockResolvedValueOnce({ data: { updated: true }, error: null });

      const update = useUpdateVariantInventoryUnit();
      const payload = {
        unitId: 'unit-1',
        productId: 'product-1',
        identifierValue: 'new-identifier',
        status: 'defective' as const,
        branchId: 'branch-2',
        setBranch: true,
        notes: 'Updated note',
      };

      await update.mutateAsync(payload);

      expect(mocks.rpc).toHaveBeenCalledWith('update_variant_inventory_unit', {
        p_merchant_id: 'merchant-1',
        p_unit_id: 'unit-1',
        p_identifier_value: 'new-identifier',
        p_status: 'defective',
        p_branch_id: 'branch-2',
        p_set_branch: true,
        p_notes: 'Updated note',
      });

      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['variant-inventory', 'merchant-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['product', 'merchant-1', 'product-1'],
      });
    });
  });

  describe('useDeleteVariantInventoryUnit mutation', () => {
    it('calls delete_variant_inventory_unit and invalidates queries on success', async () => {
      const mockResult = {
        deleted: true,
        productId: 'product-1',
        variantId: 'variant-1',
        branchId: 'branch-1',
        stockSynced: true,
      };
      mocks.rpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const deleteHook = useDeleteVariantInventoryUnit();
      await deleteHook.mutateAsync({
        unitId: 'unit-1',
        productId: 'product-1',
      });

      expect(mocks.rpc).toHaveBeenCalledWith('delete_variant_inventory_unit', {
        p_merchant_id: 'merchant-1',
        p_unit_id: 'unit-1',
      });

      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['variant-inventory', 'merchant-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['product', 'merchant-1', 'product-1'],
      });
    });
  });

  describe('useUpdateInventoryTrackingPolicy mutation', () => {
    it('calls update_inventory_tracking_policy and invalidates queries on success', async () => {
      mocks.rpc.mockResolvedValueOnce({ data: { updated: true }, error: null });

      const policyHook = useUpdateInventoryTrackingPolicy();
      const payload = {
        productId: 'product-1',
        inventoryTrackingPolicy: 'serialized_strict' as const,
        variantId: 'variant-1',
      };

      await policyHook.mutateAsync(payload);

      expect(mocks.rpc).toHaveBeenCalledWith(
        'update_inventory_tracking_policy',
        {
          p_merchant_id: 'merchant-1',
          p_product_id: 'product-1',
          p_inventory_tracking_policy: 'serialized_strict',
          p_variant_id: 'variant-1',
        }
      );

      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['variant-inventory', 'merchant-1'],
      });
      expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['product', 'merchant-1', 'product-1'],
      });
    });
  });
});
