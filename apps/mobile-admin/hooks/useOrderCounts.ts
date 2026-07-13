import { useQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import {
  ALL_BRANCH_SCOPE,
  type BranchScope,
  serializeBranchScope,
} from '@/schemas/branch';
import { type OrderCounts, orderCountsSchema } from '@/schemas/order-counts';
import { useBranchScope } from './useBranchScope';
import { useMerchant } from './useMerchant';

export type { OrderCounts } from '@/schemas/order-counts';

export async function fetchOrderCounts(
  merchantId: string,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<OrderCounts> {
  const { data, error } = await supabase.rpc('get_mobile_admin_order_counts', {
    p_branch_id: serializeBranchScope(scope),
    p_merchant_id: merchantId,
  });

  if (error) {
    throw new Error(`Failed to fetch order counts: ${error.message}`);
  }

  return orderCountsSchema.parse(data);
}

export function useOrderCounts() {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  return useQuery({
    queryKey: ['order-counts', merchantId, branchScopeKey],
    queryFn: () => {
      if (!merchantId) {
        throw new Error('Merchant ID is required');
      }

      return fetchOrderCounts(merchantId, scope);
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
