/**
 * useVariantInventory Hook
 * Manages serialized variant inventory fetching with TanStack Query + Supabase RPC.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import type {
  VariantInventoryCursor,
  VariantInventoryFilters,
  VariantInventoryPage,
  VariantInventoryUnit,
} from './useVariantInventory.types';

export type {
  DeleteVariantInventoryUnitResult,
  DeleteVariantInventoryUnitVariables,
  InventoryTrackingPolicy,
  RestockUnitInput,
  RestockVariantInventoryResult,
  RestockVariantInventoryVariables,
  UpdateInventoryTrackingPolicyVariables,
  UpdateVariantInventoryUnitVariables,
  VariantInventoryCursor,
  VariantInventoryFilters,
  VariantInventoryPage,
  VariantInventorySource,
  VariantInventoryStatus,
  VariantInventoryUnit,
} from './useVariantInventory.types';

export {
  useDeleteVariantInventoryUnit,
  useRestockVariantInventory,
  useUpdateInventoryTrackingPolicy,
  useUpdateVariantInventoryUnit,
} from './useVariantInventoryMutations';

/**
 * Hook to fetch paginated units for a variant or product.
 */
export function useVariantInventory(filters: VariantInventoryFilters) {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useInfiniteQuery<VariantInventoryPage, Error>({
    enabled: !!merchantId && !!filters.productId,
    queryKey: ['variant-inventory', merchantId, filters],
    initialPageParam: null as VariantInventoryCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!merchantId) throw new Error('No merchant');
      const cursor = pageParam as VariantInventoryCursor | null;

      const { data, error } = await supabase.rpc(
        'list_variant_inventory_units',
        {
          p_merchant_id: merchantId,
          p_product_id: filters.productId,
          p_variant_id: filters.variantId || null,
          p_status: filters.status || null,
          p_branch_scope: filters.branchScope || 'all',
          p_branch_id: filters.branchId || null,
          p_limit: filters.limit || 50,
          p_cursor_created_at: cursor?.created_at || null,
          p_cursor_id: cursor?.id || null,
        }
      );

      if (error) {
        console.error('[VariantInventory] List fetch error:', error);
        throw new Error(error.message);
      }

      const result = data as unknown as {
        units: VariantInventoryUnit[] | null;
        nextCursor: VariantInventoryCursor | null;
        hasMore: boolean;
      };

      return {
        units: result?.units || [],
        nextCursor: result?.nextCursor || null,
        hasMore: !!result?.hasMore,
      };
    },
    staleTime: 1000 * 30,
  });
}
