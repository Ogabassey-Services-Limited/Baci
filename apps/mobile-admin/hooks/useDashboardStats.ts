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

function getPreviousPeriodDateRange(period: TimePeriod): { start: string | null; end: string } | null {
  const now = new Date();

  switch (period) {
    case 'today': {
      // Yesterday
      const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: yesterdayStart.toISOString(), end: yesterdayEnd.toISOString() };
    }
    case 'week': {
      // Previous 7 days (8-14 days ago)
      const prevWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      return { start: prevWeekStart.toISOString(), end: prevWeekEnd.toISOString() };
    }
    case 'month': {
      // Previous month
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: prevMonthStart.toISOString(), end: prevMonthEnd.toISOString() };
    }
    case 'all':
      return null; // No comparison for all time
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

  // Fetch revenue for period (total order value - gross revenue)
  // Note: This shows total order value regardless of payment status
  // for a more useful dashboard metric
  let revenueQuery = supabase
    .from('orders')
    .select('total')
    .eq('merchant_id', merchantId);

  if (start) {
    revenueQuery = revenueQuery.gte('created_at', start);
  }

  const { data: revenueData } = await revenueQuery;
  const revenue = revenueData?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0;
  const avgOrderValue = orders && orders > 0 ? revenue / orders : 0;

  // Fetch previous period revenue for comparison
  let previousPeriodRevenue = 0;
  const prevPeriod = getPreviousPeriodDateRange(period);
  if (prevPeriod) {
    const { data: prevRevenueData } = await supabase
      .from('orders')
      .select('total')
      .eq('merchant_id', merchantId)
      .gte('created_at', prevPeriod.start!)
      .lt('created_at', prevPeriod.end);
    previousPeriodRevenue = prevRevenueData?.reduce((sum, order) => sum + (order.total || 0), 0) ?? 0;
  }

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
    previousPeriodRevenue,
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

async function fetchTopProducts(merchantId: string, limit: number = 5): Promise<TopProduct[]> {
  // Get top selling products by quantity sold
  const { data, error } = await supabase
    .rpc('get_top_products', { p_merchant_id: merchantId, p_limit: limit });

  if (error) {
    // Fallback: manual query if RPC doesn't exist
    console.log('[DashboardStats] RPC not available, using fallback query');

    const { data: orderItems } = await supabase
      .from('order_items')
      .select(`
        quantity,
        price,
        product_id,
        products!inner(id, name, price, images),
        orders!inner(merchant_id)
      `)
      .eq('orders.merchant_id', merchantId);

    if (!orderItems) return [];

    // Aggregate by product
    const productMap = new Map<string, {
      id: string;
      name: string;
      price: number;
      images: string[];
      totalSold: number;
      totalRevenue: number
    }>();

    for (const item of orderItems) {
      // Handle potential array or single object from join
      const productRaw = item.products;
      if (!productRaw) continue;

      const product = (Array.isArray(productRaw) ? productRaw[0] : productRaw) as { id: string; name: string; price: number; images: string[] };
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

    return sorted.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      imageUrl: p.images[0] || null,
      totalSold: p.totalSold,
      totalRevenue: p.totalRevenue,
    }));
  }

  return (data || []).map((p: { id: string; name: string; price: number; image_url: string; total_sold: number; total_revenue: number }) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.image_url,
    totalSold: p.total_sold,
    totalRevenue: p.total_revenue,
  }));
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

  const topProductsQuery = useQuery({
    queryKey: ['top-products', merchantId],
    queryFn: () => fetchTopProducts(merchantId!, 5),
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

