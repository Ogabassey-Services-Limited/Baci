import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type { UpdateVariantInventoryUnitVariables } from './useVariantInventory.types';
import {
  invalidateVariantInventoryQueries,
  toInventoryMutationError,
} from './useVariantInventoryInvalidation';

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
          p_branch_id: branchId ?? null,
          p_set_branch: setBranch ?? false,
          p_notes: notes ?? null,
        }
      );

      if (error) {
        console.error('[VariantInventory] Update error:', error);
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
