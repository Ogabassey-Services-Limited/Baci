/**
 * useDashboardStats Hook
 * Fetches dashboard statistics from Supabase
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
}

export interface RevenueDataPoint {
  label: string;
  value: number;
}

function getDateRange(period: TimePeriod): { start: string | null; end: string } {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case 'today':
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: startOfDay.toISOString(), end };
    case 'week':
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: startOfWeek.toISOString(), end };
    case 'month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth.toISOString(), end };
    case 'all':
      return { start: null, end };
  }
}

async function fetchDashboardStats(merchantId: string, period: TimePeriod): Promise<DashboardStats> {
  console.log('[DashboardStats] Fetching for merchant:', merchantId, 'period:', period);

  const { start } = getDateRange(period);

  // Build base query for orders
  let ordersQuery = supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  if (start) {
    ordersQuery = ordersQuery.gte('created_at', start);
  }

  const { count: orders, error: ordersError } = await ordersQuery;
  console.log('[DashboardStats] Orders:', orders, 'Error:', ordersError);

  // Fetch pending orders (always total, not filtered by period)
  const { count: pendingOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('shipping_status', 'pending');

  // Fetch total items for period
  let itemsQuery = supabase
    .from('order_items')
    .select('quantity, orders!inner(merchant_id, created_at)')
    .eq('orders.merchant_id', merchantId);

  if (start) {
    itemsQuery = itemsQuery.gte('orders.created_at', start);
  }

  const { data: itemsData } = await itemsQuery;
  const totalItems = itemsData?.reduce((sum, item) => sum + (item.quantity || 1), 0) ?? 0;

  // Fetch customers for period
  let customersQuery = supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  if (start) {
    customersQuery = customersQuery.gte('created_at', start);
  }

  const { count: newCustomers } = await customersQuery;

  // Total customers (always all-time)
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  // Fetch revenue for period
  let revenueQuery = supabase
    .from('orders')
    .select('total')
    .eq('merchant_id', merchantId)
    .eq('payment_status', 'paid');

  if (start) {
    revenueQuery = revenueQuery.gte('created_at', start);
  }

  const { data: revenueData } = await revenueQuery;
  const revenue = revenueData?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0;
  const avgOrderValue = orders && orders > 0 ? revenue / orders : 0;

  // Fetch visits for period
  let visitsQuery = supabase
    .from('analytics_events')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('event_type', 'page_view');

  if (start) {
    visitsQuery = visitsQuery.gte('created_at', start);
  }

  const { count: visits } = await visitsQuery;

  return {
    orders: orders ?? 0,
    totalItems,
    visits: visits ?? 0,
    avgOrderValue: Math.round(avgOrderValue),
    newCustomers: newCustomers ?? 0,
    totalCustomers: totalCustomers ?? 0,
    pendingOrders: pendingOrders ?? 0,
    revenue,
  };
}

async function fetchRevenueChart(merchantId: string, period: TimePeriod): Promise<RevenueDataPoint[]> {
  const result: RevenueDataPoint[] = [];

  if (period === 'today') {
    // Show hourly data for today (6 time slots)
    const now = new Date();
    const slots = [
      { label: '12am', start: 0, end: 4 },
      { label: '4am', start: 4, end: 8 },
      { label: '8am', start: 8, end: 12 },
      { label: '12pm', start: 12, end: 16 },
      { label: '4pm', start: 16, end: 20 },
      { label: '8pm', start: 20, end: 24 },
    ];

    for (const slot of slots) {
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.start).toISOString();
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.end).toISOString();

      const { data } = await supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', merchantId)
        .eq('payment_status', 'paid')
        .gte('created_at', startTime)
        .lt('created_at', endTime);

      result.push({
        label: slot.label,
        value: data?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0,
      });
    }
  } else if (period === 'week') {
    // Show daily data for last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

      const { data } = await supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', merchantId)
        .eq('payment_status', 'paid')
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay);

      result.push({
        label: days[date.getDay()],
        value: data?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0,
      });
    }
  } else if (period === 'month') {
    // Show weekly data for this month (4-5 weeks)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weeksInMonth = Math.ceil((now.getDate() + startOfMonth.getDay()) / 7);

    for (let week = 0; week < Math.min(weeksInMonth, 5); week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(weekStart.getDate() + week * 7 - startOfMonth.getDay());
      if (weekStart < startOfMonth) weekStart.setTime(startOfMonth.getTime());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (weekEnd > now) weekEnd.setTime(now.getTime());

      const { data } = await supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', merchantId)
        .eq('payment_status', 'paid')
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      result.push({
        label: `Wk ${week + 1}`,
        value: data?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0,
      });
    }
  } else {
    // 'all' - Show monthly data for last 6 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();

      const { data } = await supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', merchantId)
        .eq('payment_status', 'paid')
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      result.push({
        label: months[date.getMonth()],
        value: data?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0,
      });
    }
  }

  return result;
}

export function useDashboardStats(period: TimePeriod = 'week') {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', merchantId, period],
    queryFn: () => fetchDashboardStats(merchantId!, period),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const chartQuery = useQuery({
    queryKey: ['revenue-chart', merchantId, period],
    queryFn: () => fetchRevenueChart(merchantId!, period),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats: statsQuery.data ?? null,
    revenueData: chartQuery.data ?? [],
    isLoading: statsQuery.isLoading || chartQuery.isLoading,
    error: statsQuery.error || chartQuery.error,
    refetch: () => {
      statsQuery.refetch();
      chartQuery.refetch();
    },
  };
}
