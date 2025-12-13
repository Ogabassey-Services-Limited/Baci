import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cache, generateCacheKey } from '@/lib/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics?startDate=ISO&endDate=ISO
 * Get real-time analytics for merchant dashboard
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Default to last 7 days if no dates provided
    const now = new Date();
    const currentPeriodEnd = endDateParam ? new Date(endDateParam) : now;
    const currentPeriodStart = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate duration to determine previous period
    const duration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const _previousPeriodEnd = new Date(currentPeriodStart.getTime());
    const _previousPeriodStart = new Date(
      currentPeriodStart.getTime() - duration
    );

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Generate cache key based on merchant ID and date range
    const cacheKey = generateCacheKey(
      'analytics',
      merchant.id,
      currentPeriodStart.toISOString(),
      currentPeriodEnd.toISOString()
    );

    // Try to get cached data (5 minute TTL)
    const cachedData = cache.get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // OPTIMIZED: Use RPC functions for efficient aggregation
    const [
      { data: summary, error: summaryError },
      { data: topProductsData, error: topProductsError },
      { data: salesByChannelData, error: salesByChannelError },
    ] = await Promise.all([
      supabase.rpc('get_analytics_summary', {
        p_merchant_id: merchant.id,
        p_start_date: currentPeriodStart.toISOString(),
        p_end_date: currentPeriodEnd.toISOString(),
      }),
      supabase.rpc('get_top_products', {
        p_merchant_id: merchant.id,
        p_start_date: currentPeriodStart.toISOString(),
        p_end_date: currentPeriodEnd.toISOString(),
        p_limit: 10,
      }),
      supabase.rpc('get_sales_by_channel', {
        p_merchant_id: merchant.id,
        p_start_date: currentPeriodStart.toISOString(),
        p_end_date: currentPeriodEnd.toISOString(),
      }),
    ]);

    if (summaryError) {
      console.error('Error fetching analytics summary:', summaryError);
    }
    if (topProductsError) {
      console.error('Error fetching top products:', topProductsError);
    }
    if (salesByChannelError) {
      console.error('Error fetching sales by channel:', salesByChannelError);
    }

    // Extract values from RPC response with defaults
    const currentRevenue = Number(summary?.currentRevenue || 0);
    const previousRevenue = Number(summary?.previousRevenue || 0);
    const currentSalesCount = Number(summary?.currentOrdersCount || 0);
    const previousSalesCount = Number(summary?.previousOrdersCount || 0);
    const totalCustomers = Number(summary?.totalCustomers || 0);
    const previousCustomers = Number(summary?.previousCustomers || 0);
    const recentActivity = Number(summary?.activeNow || 0);
    const refundedOrdersCount = Number(summary?.currentRefundedCount || 0);

    // Calculate changes
    const revenueChange =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;
    const salesChange =
      previousSalesCount > 0
        ? ((currentSalesCount - previousSalesCount) / previousSalesCount) * 100
        : 0;
    const customersChange =
      previousCustomers > 0
        ? ((totalCustomers - previousCustomers) / previousCustomers) * 100
        : 0;

    // Calculate chart data (simplified - just show daily/monthly buckets)
    // Note: For complex chart data, consider a separate RPC
    const daysDiff = Math.ceil(duration / (1000 * 60 * 60 * 24));
    const chartData: Record<string, unknown>[] = [];

    // Simplified chart - we'll generate placeholder structure
    // In production, you could create an RPC for detailed chart data
    if (daysDiff > 60) {
      // Monthly buckets
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        chartData.push({
          month: date.toLocaleString('default', {
            month: 'short',
            year: '2-digit',
          }),
          desktop: Math.round((currentRevenue / 6) * 0.6),
          mobile: Math.round((currentRevenue / 6) * 0.4),
        });
      }
    } else {
      // Daily buckets
      for (let i = 0; i < Math.min(daysDiff, 7); i++) {
        const date = new Date(currentPeriodStart);
        date.setDate(date.getDate() + i);
        chartData.push({
          day: date.toLocaleString('default', {
            weekday: 'short',
            day: 'numeric',
          }),
          desktop: Math.round((currentRevenue / daysDiff) * 0.6),
          mobile: Math.round((currentRevenue / daysDiff) * 0.4),
        });
      }
    }

    // Get recent sales (small query, kept separate for fresh data)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, customer_name, customer_email, total')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentSales = (recentOrders || []).map((order) => ({
      id: order.id,
      name: order.customer_name || 'Customer',
      email: order.customer_email || '',
      amount: order.total || 0,
      avatar: 'avatar-1',
    }));

    // Calculate AOV
    const averageOrderValue =
      currentSalesCount > 0 ? currentRevenue / currentSalesCount : 0;
    const previousAov =
      previousSalesCount > 0 ? previousRevenue / previousSalesCount : 0;
    const aovChange =
      previousAov > 0
        ? ((averageOrderValue - previousAov) / previousAov) * 100
        : 0;

    // Gross Margin (placeholder - would need cost data)
    const grossMargin = 40;
    const grossMarginChange = 2;

    // Calculate LTV
    const ltv = totalCustomers > 0 ? currentRevenue / totalCustomers : 0;
    const previousLtv =
      previousCustomers > 0 ? previousRevenue / previousCustomers : 0;
    const ltvChange =
      previousLtv > 0 ? ((ltv - previousLtv) / previousLtv) * 100 : 0;

    // Refund Rate
    const refundRate =
      currentSalesCount > 0
        ? (refundedOrdersCount / currentSalesCount) * 100
        : 0;
    const refundRateChange = refundRate - 2.5;

    const responseData = {
      summary: {
        revenue: { value: currentRevenue, change: revenueChange },
        customers: { value: totalCustomers, change: customersChange },
        sales: { value: currentSalesCount, change: salesChange },
        activeNow: { value: recentActivity, change: 0 },
        aov: { value: averageOrderValue, change: aovChange },
        grossMargin: { value: grossMargin, change: grossMarginChange },
        ltv: { value: ltv, change: ltvChange },
        refundRate: { value: refundRate, change: refundRateChange },
      },
      chartData,
      recentSales,
      topProducts:
        (topProductsData as unknown as Record<string, unknown>[]) || [],
      salesByChannel:
        (salesByChannelData as unknown as Record<string, unknown>[]) || [],
    };

    // Cache the response for 5 minutes (300 seconds)
    cache.set(cacheKey, responseData, 300);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
