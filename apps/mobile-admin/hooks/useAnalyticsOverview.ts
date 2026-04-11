import type { MerchantAnalyticsResponse } from '@baci/shared';
import { useQuery } from '@tanstack/react-query';
import { useMerchant } from '@/hooks/useMerchant';
import type { AnalyticsDateRange } from '@/lib/analytics-period';
import { apiClient } from '@/lib/api-client';

export function useAnalyticsOverview(range: AnalyticsDateRange) {
  const { merchant } = useMerchant();

  return useQuery<MerchantAnalyticsResponse>({
    queryKey: [
      'analytics-overview',
      merchant?.id,
      range.startDate.toISOString(),
      range.endDate.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        endDate: range.endDate.toISOString(),
        startDate: range.startDate.toISOString(),
      });

      return apiClient<MerchantAnalyticsResponse>(
        `/api/analytics?${params.toString()}`
      );
    },
    enabled: Boolean(merchant?.id),
    staleTime: 1000 * 60 * 2,
  });
}
