import type { MerchantAnalyticsResponse } from '@baci/shared';
import { useQuery } from '@tanstack/react-query';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useMerchant } from '@/hooks/useMerchant';
import type { AnalyticsDateRange } from '@/lib/analytics-period';
import { apiClient } from '@/lib/api-client';

export function useAnalyticsOverview(range: AnalyticsDateRange) {
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const branchScopeKey = scope.type === 'branch' ? scope.branchId : 'all';

  return useQuery<MerchantAnalyticsResponse>({
    queryKey: [
      'analytics-overview',
      merchant?.id,
      range.startDate.toISOString(),
      range.endDate.toISOString(),
      branchScopeKey,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        endDate: range.endDate.toISOString(),
        startDate: range.startDate.toISOString(),
      });
      if (scope.type === 'branch') {
        params.set('branchId', scope.branchId);
      }

      return apiClient<MerchantAnalyticsResponse>(
        `/api/analytics?${params.toString()}`,
        {
          headers: { 'x-baci-merchant-id': merchant?.id ?? '' },
        }
      );
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60 * 2,
  });
}
