import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type {
  DeleteVariantInventoryUnitResult,
  DeleteVariantInventoryUnitVariables,
  RestockVariantInventoryResult,
  RestockVariantInventoryVariables,
  UpdateInventoryTrackingPolicyVariables,
  UpdateVariantInventoryUnitVariables,
} from './useVariantInventory.types';

type QueryClient = ReturnType<typeof useQueryClient>;

function invalidateInventoryQueries(
  queryClient: QueryClient,
  merchantId: string | undefined,
  productId?: string
) {
  queryClient.invalidateQueries({
    queryKey: ['variant-inventory', merchantId],
  });
  queryClient.invalidateQueries({ queryKey: ['products', merchantId] });

  if (productId) {
    queryClient.invalidateQueries({
      queryKey: ['product', merchantId, productId],
    });
  }

  queryClient.invalidateQueries({ queryKey: ['inventory-stats', merchantId] });
}

export function useRestockVariantInventory() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useMutation<
    RestockVariantInventoryResult,
    Error,
    RestockVariantInventoryVariables
  >({
    mutationFn: async ({
      productId,
      units,
      variantId,
      inventoryTrackingPolicy,
      branchId,
    }) => {
      if (!merchantId) throw new Error('No merchant');

      const { data, error } = await supabase.rpc(
        'restock_variant_inventory_units',
        {
          p_merchant_id: merchantId,
          p_product_id: productId,
          p_units: units,
          p_variant_id: variantId || null,
          p_inventory_tracking_policy: inventoryTrackingPolicy || null,
          p_branch_id: branchId || null,
        }
      );

      if (error) {
        console.error('[VariantInventory] Restock error:', error);
        throw error;
      }

      return data as RestockVariantInventoryResult;
    },
    onSuccess: (data) => {
      invalidateInventoryQueries(queryClient, merchantId, data.productId);
    },
  });
}

export function useUpdateVariantInventoryUnit() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useMutation<unknown, Error, UpdateVariantInventoryUnitVariables>({
    mutationFn: async ({
      unitId,
      identifierValue,
      status,
      branchId,
      setBranch,
      notes,
    }) => {
      if (!merchantId) throw new Error('No merchant');

      const { data, error } = await supabase.rpc(
        'update_variant_inventory_unit',
        {
          p_merchant_id: merchantId,
          p_unit_id: unitId,
          p_identifier_value: identifierValue ?? null,
          p_status: status ?? null,
          p_branch_id: branchId || null,
          p_set_branch: setBranch || false,
          p_notes: notes || null,
        }
      );

      if (error) {
        console.error('[VariantInventory] Update error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      invalidateInventoryQueries(queryClient, merchantId, variables.productId);
    },
  });
}

export function useDeleteVariantInventoryUnit() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useMutation<
    DeleteVariantInventoryUnitResult,
    Error,
    DeleteVariantInventoryUnitVariables
  >({
    mutationFn: async ({ unitId }) => {
      if (!merchantId) throw new Error('No merchant');

      const { data, error } = await supabase.rpc(
        'delete_variant_inventory_unit',
        {
          p_merchant_id: merchantId,
          p_unit_id: unitId,
        }
      );

      if (error) {
        console.error('[VariantInventory] Delete error:', error);
        throw error;
      }

      return data as DeleteVariantInventoryUnitResult;
    },
    onSuccess: (data) => {
      invalidateInventoryQueries(queryClient, merchantId, data.productId);
    },
  });
}

export function useUpdateInventoryTrackingPolicy() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useMutation<unknown, Error, UpdateInventoryTrackingPolicyVariables>({
    mutationFn: async ({ productId, inventoryTrackingPolicy, variantId }) => {
      if (!merchantId) throw new Error('No merchant');

      const { data, error } = await supabase.rpc(
        'update_inventory_tracking_policy',
        {
          p_merchant_id: merchantId,
          p_product_id: productId,
          p_inventory_tracking_policy: inventoryTrackingPolicy,
          p_variant_id: variantId || null,
        }
      );

      if (error) {
        console.error('[VariantInventory] Policy update error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      invalidateInventoryQueries(queryClient, merchantId, variables.productId);
    },
  });
}
