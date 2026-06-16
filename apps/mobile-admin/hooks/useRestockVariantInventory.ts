import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type {
  RestockVariantInventoryResult,
  RestockVariantInventoryVariables,
} from './useVariantInventory.types';
import {
  invalidateVariantInventoryQueries,
  toInventoryMutationError,
} from './useVariantInventoryInvalidation';

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
        throw toInventoryMutationError(error);
      }

      return data as RestockVariantInventoryResult;
    },
    onSuccess: (data) => {
      invalidateVariantInventoryQueries(
        queryClient,
        merchantId,
        data.productId
      );
    },
  });
}
