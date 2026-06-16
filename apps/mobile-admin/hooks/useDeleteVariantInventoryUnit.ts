import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type {
  DeleteVariantInventoryUnitResult,
  DeleteVariantInventoryUnitVariables,
} from './useVariantInventory.types';
import {
  invalidateVariantInventoryQueries,
  toInventoryMutationError,
} from './useVariantInventoryInvalidation';

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
        throw toInventoryMutationError(error);
      }

      return data as DeleteVariantInventoryUnitResult;
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
