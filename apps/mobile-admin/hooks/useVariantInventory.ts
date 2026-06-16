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

interface VariantInventoryRpcResult {
  units: VariantInventoryUnit[] | null;
  nextCursor: VariantInventoryCursor | null;
  hasMore: boolean;
}

function parseVariantInventoryRpcResult(
  data: unknown
): VariantInventoryRpcResult | null {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid variant inventory response');
  }

  const result = data as Record<string, unknown>;
  if (
    !(Array.isArray(result.units) || result.units === null) ||
    !(
      (typeof result.nextCursor === 'object' &&
        !Array.isArray(result.nextCursor)) ||
      result.nextCursor === null
    ) ||
    typeof result.hasMore !== 'boolean'
  ) {
    throw new Error('Invalid variant inventory response');
  }

  return {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor as VariantInventoryCursor | null,
    units: result.units as VariantInventoryUnit[] | null,
  };
}

export { useDeleteVariantInventoryUnit } from './useDeleteVariantInventoryUnit';
export { useRestockVariantInventory } from './useRestockVariantInventory';
export { useUpdateInventoryTrackingPolicy } from './useUpdateInventoryTrackingPolicy';
export { useUpdateVariantInventoryUnit } from './useUpdateVariantInventoryUnit';
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
        throw new Error(error.message);
      }

      const result = parseVariantInventoryRpcResult(data);

      return {
        units: result?.units || [],
        nextCursor: result?.nextCursor || null,
        hasMore: !!result?.hasMore,
      };
    },
    staleTime: 1000 * 30,
  });
}
