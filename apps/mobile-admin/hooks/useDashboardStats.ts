/**
 * useDashboardStats Hook
 * Fetches dashboard statistics from Supabase
 */

import { useQuery } from '@tanstack/react-query';
import {
  applyOrderBranchScope,
  getBranchScopeKey,
} from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import { useBranchScope } from './useBranchScope';
import { useMerchant } from './useMerchant';

export type TimePeriod = 'today' | 'week' | 'month' | 'all';

export interface DashboardStats {
  orders: number;
  totalItems: number;
  visits: number;
  avgOrderValue: number;
  newCustomers: number;
  totalCustomers: number;
  pendingOrders: number;
  revenue: number;
  previousPeriodRevenue: number;
}

export interface RevenueDataPoint {
  label: string;
  value: number;
}

export interface TopProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  totalSold: number;
  totalRevenue: number;
}

function getDateRange(period: TimePeriod): {
  start: string | null;
  end: string;
} {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case 'today': {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return { start: startOfDay.toISOString(), end };
    }
    case 'week': {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: startOfWeek.toISOString(), end };
    }
    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth.toISOString(), end };
    }
    case 'all':
      return { start: null, end };
  }
}

function getPreviousPeriodDateRange(
  period: TimePeriod
): { start: string | null; end: string } | null {
  const now = new Date();

  switch (period) {
    case 'today': {
      // Yesterday
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      );
      const yesterdayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      return {
        start: yesterdayStart.toISOString(),
        end: yesterdayEnd.toISOString(),
      };
    }
    case 'week': {
      // Previous 7 days (8-14 days ago)
      const prevWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return {
        start: prevWeekStart.toISOString(),
        end: prevWeekEnd.toISOString(),
      };
    }
    case 'month': {
      // Previous month
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: prevMonthStart.toISOString(),
        end: prevMonthEnd.toISOString(),
      };
    }
    case 'all':
      return null; // No comparison for all time
  }
}

// Exported for testing the throw-on-error behavior in isolation.
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

  // Build base query for orders
  let ordersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);
  ordersQuery = applyOrderBranchScope(ordersQuery, scope);

  if (start) {
    ordersQuery = ordersQuery.gte('created_at', start);
  }

  // Fetch pending orders (always total, not filtered by period)
  let pendingOrdersQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('shipping_status', 'pending');
  pendingOrdersQuery = applyOrderBranchScope(pendingOrdersQuery, scope);

  // Fetch total items for period
  const itemsOrderColumns =
    scope.type === 'branch'
      ? 'merchant_id, branch_id, created_at'
      : 'merchant_id, created_at';
  let itemsQuery = supabase
    .from('order_items')
    .select(`quantity, orders!inner(${itemsOrderColumns})`)
    .eq('orders.merchant_id', merchantId);
  itemsQuery = applyOrderBranchScope(itemsQuery, scope, 'orders.branch_id');

  if (start) {
    itemsQuery = itemsQuery.gte('orders.created_at', start);
  }

  // Customer counts intentionally stay cross-branch; (tabs)/index.tsx labels them as all stores.
  let customersQuery = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  if (start) {
    customersQuery = customersQuery.gte('created_at', start);
  }

  // Total customers intentionally stay cross-branch; (tabs)/index.tsx labels them as all stores.
  const totalCustomersQuery = supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  // Fetch revenue for period (total order value - gross revenue)
  let revenueQuery = supabase
    .from('orders')
    .select('total')
    .eq('merchant_id', merchantId);
  revenueQuery = applyOrderBranchScope(revenueQuery, scope);

  if (start) {
    revenueQuery = revenueQuery.gte('created_at', start);
  }

  // Fetch previous period revenue for comparison
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

  // Visits intentionally stay cross-branch; (tabs)/index.tsx labels them as all stores.
  let visitsQuery = supabase
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('event_type', 'page_view');

  if (start) {
    visitsQuery = visitsQuery.gte('created_at', start);
  }

  // PERFORMANCE: Use Promise.all to fetch independent queries concurrently
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

  // Surface the first query error to React Query so UI shows real failure
  // state instead of fake zeros from `?? 0` fallbacks.
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
    orders: orders ?? 0,
    totalItems,
    visits: visits ?? 0,
    avgOrderValue: Math.round(avgOrderValue),
    newCustomers: newCustomers ?? 0,
    totalCustomers: totalCustomers ?? 0,
    pendingOrders: pendingOrders ?? 0,
    revenue,
    previousPeriodRevenue,
  };
}

async function fetchRevenueChart(
  merchantId: string,
  period: TimePeriod,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<RevenueDataPoint[]> {
  const now = new Date();

  // Determine the overall date range for a single query
  let rangeStart: Date;
  const rangeEnd: Date = now;

  if (period === 'today') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    rangeStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    rangeStart = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate()
    );
  } else if (period === 'month') {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // 'all' - last 6 months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    rangeStart = new Date(
      sixMonthsAgo.getFullYear(),
      sixMonthsAgo.getMonth(),
      1
    );
  }

  // Single query for the entire period
  let ordersQuery = supabase
    .from('orders')
    .select('total, created_at')
    .eq('merchant_id', merchantId)
    .gte('created_at', rangeStart.toISOString())
    .lte('created_at', rangeEnd.toISOString());
  ordersQuery = applyOrderBranchScope(ordersQuery, scope);

  const { data: orders, error } = await ordersQuery;

  if (error) {
    throw new Error(`fetchRevenueChart orders query failed: ${error.message}`);
  }

  // Bucket orders client-side
  if (period === 'today') {
    const slots = [
      { label: '12am', start: 0, end: 4 },
      { label: '4am', start: 4, end: 8 },
      { label: '8am', start: 8, end: 12 },
      { label: '12pm', start: 12, end: 16 },
      { label: '4pm', start: 16, end: 20 },
      { label: '8pm', start: 20, end: 24 },
    ];
    const buckets = slots.map((slot) => ({ label: slot.label, value: 0 }));

    orders?.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      const slotIndex = slots.findIndex((s) => hour >= s.start && hour < s.end);
      if (slotIndex >= 0) {
        buckets[slotIndex].value += order.total || 0;
      }
    });

    return buckets;
  }

  if (period === 'week') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Build 7-day buckets from oldest to newest
    const dayBuckets: { label: string; date: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      dayBuckets.push({ label: days[date.getDay()], date: dateStr, value: 0 });
    }

    orders?.forEach((order) => {
      const d = new Date(order.created_at);
      const dateStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const bucket = dayBuckets.find((b) => b.date === dateStr);
      if (bucket) {
        bucket.value += order.total || 0;
      }
    });

    return dayBuckets.map(({ label, value }) => ({ label, value }));
  }

  if (period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weeksInMonth = Math.ceil((now.getDate() + startOfMonth.getDay()) / 7);
    const weekCount = Math.min(weeksInMonth, 5);

    // Build week boundary dates
    const weekBuckets: {
      label: string;
      start: Date;
      end: Date;
      value: number;
    }[] = [];
    for (let week = 0; week < weekCount; week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + week * 7 - startOfMonth.getDay());
      if (weekStart < startOfMonth) weekStart.setTime(startOfMonth.getTime());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (weekEnd > now) weekEnd.setTime(now.getTime());

      weekBuckets.push({
        label: `Wk ${week + 1}`,
        start: weekStart,
        end: weekEnd,
        value: 0,
      });
    }

    orders?.forEach((order) => {
      const orderDate = new Date(order.created_at);
      for (const bucket of weekBuckets) {
        if (orderDate >= bucket.start && orderDate < bucket.end) {
          bucket.value += order.total || 0;
          break;
        }
      }
    });

    return weekBuckets.map(({ label, value }) => ({ label, value }));
  }

  // 'all' - last 6 months
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthBuckets: {
    label: string;
    year: number;
    month: number;
    value: number;
  }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    monthBuckets.push({
      label: months[date.getMonth()],
      year: date.getFullYear(),
      month: date.getMonth(),
      value: 0,
    });
  }

  orders?.forEach((order) => {
    const d = new Date(order.created_at);
    const bucket = monthBuckets.find(
      (b) => b.year === d.getFullYear() && b.month === d.getMonth()
    );
    if (bucket) {
      bucket.value += order.total || 0;
    }
  });

  return monthBuckets.map(({ label, value }) => ({ label, value }));
}

export async function fetchTopProducts(
  merchantId: string,
  limit: number = 5,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<TopProduct[]> {
  const startDate = new Date(0).toISOString();
  const endDate = new Date().toISOString();

  const fetchFromOrderItems = async () => {
    const orderColumns =
      scope.type === 'branch' ? 'merchant_id, branch_id' : 'merchant_id';
    let orderItemsQuery = supabase
      .from('order_items')
      .select(`
        quantity,
        price,
        product_id,
        products!inner(id, name, price, images),
        orders!inner(${orderColumns})
      `)
      .eq('orders.merchant_id', merchantId);

    orderItemsQuery = applyOrderBranchScope(
      orderItemsQuery,
      scope,
      'orders.branch_id'
    );

    const { data: orderItems } = await orderItemsQuery;

    if (!orderItems) return [];

    // Aggregate by product
    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        price: number;
        images: string[];
        totalSold: number;
        totalRevenue: number;
      }
    >();

    for (const item of orderItems) {
      // Handle potential array or single object from join
      const productRaw = item.products;
      if (!productRaw) continue;

      const product = (
        Array.isArray(productRaw) ? productRaw[0] : productRaw
      ) as { id: string; name: string; price: number; images: string[] };
      if (!product?.id) continue;

      const existing = productMap.get(product.id);
      if (existing) {
        existing.totalSold += item.quantity || 1;
        existing.totalRevenue += (item.quantity || 1) * (item.price || 0);
      } else {
        productMap.set(product.id, {
          id: product.id,
          name: product.name,
          price: product.price,
          images: product.images || [],
          totalSold: item.quantity || 1,
          totalRevenue: (item.quantity || 1) * (item.price || 0),
        });
      }
    }

    // Sort by total sold and return top N
    const sorted = Array.from(productMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit);

    return sorted.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.images[0] || null,
      totalSold: p.totalSold,
      totalRevenue: p.totalRevenue,
    }));
  };

  if (scope.type === 'branch') {
    return fetchFromOrderItems();
  }

  // Get top selling products by quantity sold
  const { data, error } = await supabase.rpc('get_top_products', {
    p_merchant_id: merchantId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_limit: limit,
  });

  if (error) {
    // Fallback: manual query if RPC doesn't exist
    if (__DEV__) {
      console.log('[DashboardStats] RPC not available, using fallback query');
    }

    return fetchFromOrderItems();
  }

  return (data || []).map(
    (p: {
      id: string;
      name: string;
      price: number;
      image_url: string;
      total_sold: number;
      total_revenue: number;
    }) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.image_url,
      totalSold: p.total_sold,
      totalRevenue: p.total_revenue,
    })
  );
}

export function useDashboardStats(period: TimePeriod = 'week') {
  const { merchant } = useMerchant();
  const scope = useBranchScope().scope;
  const merchantId = merchant?.id;
  const branchScopeKey = getBranchScopeKey(scope);

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', merchantId, period, branchScopeKey],
    queryFn: () => fetchDashboardStats(merchantId!, period, scope),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const chartQuery = useQuery({
    queryKey: ['revenue-chart', merchantId, period, branchScopeKey],
    queryFn: () => fetchRevenueChart(merchantId!, period, scope),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const topProductsQuery = useQuery({
    queryKey: ['top-products', merchantId, branchScopeKey],
    queryFn: () => fetchTopProducts(merchantId!, 5, scope),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    stats: statsQuery.data ?? null,
    revenueData: chartQuery.data ?? [],
    topProducts: topProductsQuery.data ?? [],
    isLoading: statsQuery.isLoading || chartQuery.isLoading,
    error: statsQuery.error || chartQuery.error,
    refetch: () => {
      statsQuery.refetch();
      chartQuery.refetch();
      topProductsQuery.refetch();
    },
  };
}
