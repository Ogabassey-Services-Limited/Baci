'use server';

import { getCachedDashboardStats } from '@/lib/cached-data';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

export interface DashboardMetrics {
  revenue: {
    value: number;
    change: number;
  };
  customers: {
    value: number;
    change: number;
  };
  orders: {
    value: number;
    change: number;
  };
  activeNow: {
    value: number;
    change: number;
  };
  fulfillmentRate: number;
  aov: number;
}

export interface MonthlyChartData {
  month: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface RecentSale {
  id: string;
  name: string;
  email: string;
  amount: number;
  status: 'Completed' | 'Processing' | 'Failed' | 'Pending';
}

function getZeroDashboardMetrics(): DashboardMetrics {
  return {
    revenue: { value: 0, change: 0 },
    customers: { value: 0, change: 0 },
    orders: { value: 0, change: 0 },
    activeNow: { value: 0, change: 0 },
    fulfillmentRate: 0,
    aov: 0,
  };
}

export async function getDashboardMetrics(
  merchantId: string
): Promise<DashboardMetrics> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return getZeroDashboardMetrics();
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: merchantId,
    });

    if (!merchantContext) {
      return getZeroDashboardMetrics();
    }

    // OPTIMIZED: Use cached RPC function
    // This uses stable caching (1 min) to prevent DB hammering on refresh
    const stats = await getCachedDashboardStats(merchantContext.merchantId);

    // If RPC returns null/empty (shouldn't happen with our SQL logic but safe to handle)
    if (!stats) {
      return getZeroDashboardMetrics();
    }

    return {
      revenue: stats.revenue,
      customers: stats.customers,
      orders: stats.orders,
      activeNow: stats.activeNow,
      fulfillmentRate: stats.fulfillmentRate,
      aov: stats.aov,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard metrics:', error);
    return getZeroDashboardMetrics();
  }
}

export async function getRecentSales(
  merchantId: string,
  limit = 5
): Promise<RecentSale[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return [];
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: merchantId,
    });

    if (!merchantContext) {
      return [];
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_email, total, payment_status')
      .eq('merchant_id', merchantContext.merchantId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent sales:', error);
      return [];
    }

    return (orders || []).map((order) => ({
      id: order.id,
      name: order.customer_name || 'Unknown Customer',
      email: order.customer_email || 'no-email@example.com',
      amount: Number(order.total) || 0,
      status: 'Completed',
    }));
  } catch (error) {
    console.error('Failed to fetch recent sales:', error);
    return [];
  }
}

export async function getMonthlyChartData(
  merchantId: string
): Promise<MonthlyChartData[]> {
  try {
    const supabase = await createClient();

    // OPTIMIZED: Use database RPC function
    const { data: chartData, error } = await supabase.rpc(
      'get_monthly_sales_stats',
      { p_merchant_id: merchantId }
    );

    if (error) {
      console.error('Error fetching monthly chart data (RPC):', error);
      // Fallback to empty array
      return [];
    }

    return (chartData as unknown as MonthlyChartData[]) || [];
  } catch (error) {
    console.error('Failed to fetch monthly chart data:', error);
    return [];
  }
}
