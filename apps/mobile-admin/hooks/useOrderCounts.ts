import { useQuery } from '@tanstack/react-query';
import {
  applyOrderBranchScope,
  getBranchScopeKey,
} from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from './useBranchScope';
import { useMerchant } from './useMerchant';

export interface OrderCounts {
  all: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
}

export async function fetchOrderCounts(
  merchantId: string,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<OrderCounts> {
  // We perform parallel queries for each status to get exact counts
  // This is more efficient than fetching all orders and filtering client-side for large datasets,
  // though for small shops, client-side might be fine. We stick to server-side counts for scalability.

  const labels = [
    'all',
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned',
  ] as const;

  const buildCountQuery = (status?: (typeof labels)[number]) => {
    let query = supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    if (status && status !== 'all') {
      query = query.eq('shipping_status', status);
    }

    return applyOrderBranchScope(query, scope);
  };

  const results = await Promise.all(
    labels.map((label) => buildCountQuery(label))
  );

  // Check each result for errors
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.error) {
      throw new Error(
        `Failed to fetch ${labels[i]} order count: ${result.error.message}`
      );
    }
  }

  return {
    all: results[0].count ?? 0,
    pending: results[1].count ?? 0,
    processing: results[2].count ?? 0,
    shipped: results[3].count ?? 0,
    delivered: results[4].count ?? 0,
    cancelled: results[5].count ?? 0,
    returned: results[6].count ?? 0,
  };
}

export function useOrderCounts() {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  return useQuery({
    queryKey: ['order-counts', merchantId, branchScopeKey],
    queryFn: () => fetchOrderCounts(merchantId!, scope),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
