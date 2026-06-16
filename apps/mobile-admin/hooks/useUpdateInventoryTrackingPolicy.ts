import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type { UpdateInventoryTrackingPolicyVariables } from './useVariantInventory.types';
import {
  invalidateVariantInventoryQueries,
  toInventoryMutationError,
} from './useVariantInventoryInvalidation';

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
        throw toInventoryMutationError(error);
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      invalidateVariantInventoryQueries(
        queryClient,
        merchantId,
        variables.productId
      );
    },
  });
}
