import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import type { DashboardStats, TimePeriod } from './dashboard-stats.types';
import {
  getDateRange,
  getPreviousPeriodDateRange,
} from './dashboard-stats-ranges';

export async function fetchDashboardStats(
  merchantId: string,
  period: TimePeriod,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<DashboardStats> {
  if (__DEV__) {
    console.log(
      '[DashboardStats] Fetching for merchant:',
      merchantId,
      'period:',
      period
    );
  }

  const prevPeriod = getPreviousPeriodDateRange(period);
  const { start } = getDateRange(period);
  const { data, error } = await supabase.rpc(
    'get_mobile_admin_dashboard_stats',
    {
      p_branch_id: scope.type === 'branch' ? scope.branchId : null,
      p_merchant_id: merchantId,
      p_previous_end_at: prevPeriod?.end ?? null,
      p_previous_start_at: prevPeriod?.start ?? null,
      p_start_at: start,
    }
  );

  if (__DEV__) {
    console.log('[DashboardStats] RPC result:', data, 'Error:', error);
  }

  if (error) {
    console.error('[DashboardStats] Query error:', error);
    throw error;
  }

  const stats = (data ?? {}) as Partial<DashboardStats>;

  return {
    avgOrderValue: Number(stats.avgOrderValue ?? 0),
    newCustomers: Number(stats.newCustomers ?? 0),
    orders: Number(stats.orders ?? 0),
    pendingOrders: Number(stats.pendingOrders ?? 0),
    previousPeriodRevenue: Number(stats.previousPeriodRevenue ?? 0),
    revenue: Number(stats.revenue ?? 0),
    totalCustomers: Number(stats.totalCustomers ?? 0),
    totalItems: Number(stats.totalItems ?? 0),
    visits: Number(stats.visits ?? 0),
  };
}
