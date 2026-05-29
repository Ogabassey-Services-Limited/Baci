import { applyOrderBranchScope } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { getDateRange, getPreviousPeriodDateRange } from './dashboard-stats-ranges';
import type { DashboardStats, TimePeriod } from './dashboard-stats.types';

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

  const { start } = getDateRange(period);
  let ordersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);
  ordersQuery = applyOrderBranchScope(ordersQuery, scope);
  if (start) ordersQuery = ordersQuery.gte('created_at', start);

  let pendingOrdersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('shipping_status', 'pending');
  pendingOrdersQuery = applyOrderBranchScope(pendingOrdersQuery, scope);

  const itemsOrderColumns =
    scope.type === 'branch'
      ? 'merchant_id, branch_id, created_at'
      : 'merchant_id, created_at';
  let itemsQuery = supabase
    .from('order_items')
    .select(`quantity, orders!inner(${itemsOrderColumns})`)
    .eq('orders.merchant_id', merchantId);
  itemsQuery = applyOrderBranchScope(itemsQuery, scope, 'orders.branch_id');
  if (start) itemsQuery = itemsQuery.gte('orders.created_at', start);

  let customersQuery = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);
  if (start) customersQuery = customersQuery.gte('created_at', start);

  const totalCustomersQuery = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  let revenueQuery = supabase
    .from('orders')
    .select('total')
    .eq('merchant_id', merchantId);
  revenueQuery = applyOrderBranchScope(revenueQuery, scope);
  if (start) revenueQuery = revenueQuery.gte('created_at', start);

  let previousPeriodRevenueQuery = null;
  const prevPeriod = getPreviousPeriodDateRange(period);
  if (prevPeriod) {
    previousPeriodRevenueQuery = supabase
      .from('orders')
      .select('total')
      .eq('merchant_id', merchantId)
      .gte('created_at', prevPeriod.start!)
      .lt('created_at', prevPeriod.end);
    previousPeriodRevenueQuery = applyOrderBranchScope(
      previousPeriodRevenueQuery,
      scope
    );
  }

  let visitsQuery = supabase
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('event_type', 'page_view');
  if (start) visitsQuery = visitsQuery.gte('created_at', start);

  const [
    { count: orders, error: ordersError },
    { count: pendingOrders, error: pendingOrdersError },
    { data: itemsData, error: itemsError },
    { count: newCustomers, error: newCustomersError },
    { count: totalCustomers, error: totalCustomersError },
    { data: revenueData, error: revenueError },
    prevRevenueResult,
    { count: visits, error: visitsError },
  ] = await Promise.all([
    ordersQuery,
    pendingOrdersQuery,
    itemsQuery,
    customersQuery,
    totalCustomersQuery,
    revenueQuery,
    previousPeriodRevenueQuery
      ? previousPeriodRevenueQuery
      : Promise.resolve({ data: null, error: null }),
    visitsQuery,
  ]);

  if (__DEV__) {
    console.log('[DashboardStats] Orders:', orders, 'Error:', ordersError);
  }

  const firstError =
    ordersError ??
    pendingOrdersError ??
    itemsError ??
    newCustomersError ??
    totalCustomersError ??
    revenueError ??
    prevRevenueResult?.error ??
    visitsError ??
    null;
  if (firstError) {
    console.error('[DashboardStats] Query error:', firstError);
    throw firstError;
  }

  const totalItems =
    itemsData?.reduce((sum, item) => sum + (item.quantity || 1), 0) ?? 0;
  const revenue =
    revenueData?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0;
  const avgOrderValue = orders && orders > 0 ? revenue / orders : 0;
  const previousPeriodRevenue =
    prevRevenueResult?.data?.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    ) ?? 0;

  return {
    avgOrderValue: Math.round(avgOrderValue),
    newCustomers: newCustomers ?? 0,
    orders: orders ?? 0,
    pendingOrders: pendingOrders ?? 0,
    previousPeriodRevenue,
    revenue,
    totalCustomers: totalCustomers ?? 0,
    totalItems,
    visits: visits ?? 0,
  };
}
