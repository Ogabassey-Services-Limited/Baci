import { useQuery } from '@tanstack/react-query';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { useBranchScope } from './useBranchScope';
import { fetchRevenueChart } from './dashboard-revenue-chart';
import { fetchDashboardStats } from './dashboard-stats-fetch';
import type {
  DashboardStats,
  RevenueDataPoint,
  TimePeriod,
  TopProduct,
} from './dashboard-stats.types';
import { fetchTopProducts } from './dashboard-top-products';
import { useMerchant } from './useMerchant';

export type { DashboardStats, RevenueDataPoint, TimePeriod, TopProduct };
export { fetchDashboardStats, fetchTopProducts };

export function useDashboardStats(period: TimePeriod = 'week') {
  const { merchant } = useMerchant();
  const scope = useBranchScope().scope;
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  const statsQuery = useQuery({
    enabled: !!merchantId,
    queryFn: () => fetchDashboardStats(merchantId!, period, scope),
    queryKey: ['dashboard-stats', merchantId, period, branchScopeKey],
    staleTime: 1000 * 60 * 2,
  });

  const chartQuery = useQuery({
    enabled: !!merchantId,
    queryFn: () => fetchRevenueChart(merchantId!, period, scope),
    queryKey: ['revenue-chart', merchantId, period, branchScopeKey],
    staleTime: 1000 * 60 * 5,
  });

  const topProductsQuery = useQuery({
    enabled: !!merchantId,
    queryFn: () => fetchTopProducts(merchantId!, 5, scope),
    queryKey: ['top-products', merchantId, branchScopeKey],
    staleTime: 1000 * 60 * 10,
  });

  return {
    error: statsQuery.error || chartQuery.error,
    isLoading: statsQuery.isLoading || chartQuery.isLoading,
    refetch: () => {
      statsQuery.refetch();
      chartQuery.refetch();
      topProductsQuery.refetch();
    },
    revenueData: chartQuery.data ?? [],
    stats: statsQuery.data ?? null,
    topProducts: topProductsQuery.data ?? [],
  };
}
