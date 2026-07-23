import { skipToken, useQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { fetchRevenueChart } from './dashboard-revenue-chart';
import type {
  DashboardStats,
  RevenueDataPoint,
  TimePeriod,
  TopProduct,
} from './dashboard-stats.types';
import { fetchDashboardStats } from './dashboard-stats-fetch';
import { fetchTopProducts } from './dashboard-top-products';
import { useBranchScope } from './useBranchScope';
import { useMerchant } from './useMerchant';

export type { DashboardStats, RevenueDataPoint, TimePeriod, TopProduct };
export { fetchDashboardStats, fetchTopProducts };

export function useDashboardStats(period: TimePeriod = 'week') {
  const { merchant } = useMerchant();
  const scope = useBranchScope().scope;
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  const {
    data: stats,
    error: statsError,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useQuery({
    enabled: !!merchantId,
    queryFn: merchantId
      ? () => fetchDashboardStats(merchantId, period, scope)
      : skipToken,
    queryKey: ['dashboard-stats', merchantId, period, branchScopeKey],
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: revenueData,
    error: chartError,
    isLoading: isChartLoading,
    refetch: refetchChart,
  } = useQuery({
    enabled: !!merchantId,
    queryFn: merchantId
      ? () => fetchRevenueChart(merchantId, period, scope)
      : skipToken,
    queryKey: ['revenue-chart', merchantId, period, branchScopeKey],
    staleTime: 1000 * 60 * 5,
  });

  const { data: topProducts, refetch: refetchTopProducts } = useQuery({
    enabled: !!merchantId,
    queryFn: merchantId
      ? () => fetchTopProducts(merchantId, 5, scope)
      : skipToken,
    queryKey: ['top-products', merchantId, branchScopeKey],
    staleTime: 1000 * 60 * 10,
  });

  return {
    error: statsError || chartError,
    isLoading: isStatsLoading || isChartLoading,
    refetch: () => {
      if (!merchantId) {
        return;
      }
      refetchStats();
      refetchChart();
      refetchTopProducts();
    },
    revenueData: revenueData ?? [],
    stats: stats ?? null,
    topProducts: topProducts ?? [],
  };
}
