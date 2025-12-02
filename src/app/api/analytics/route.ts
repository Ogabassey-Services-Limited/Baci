import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cache, generateCacheKey } from '@/lib/cache';
import { createClient } from '@/lib/supabase/server';

/**
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
      : new Date(now.setDate(now.getDate() - 7));

    // Calculate duration to determine previous period
    const duration = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const previousPeriodEnd = new Date(currentPeriodStart.getTime());
    const previousPeriodStart = new Date(
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

    // Parallelize all independent queries for maximum performance
    const [
      { data: currentOrders },
      { data: previousOrders },
      { count: totalCustomers },
      { count: previousCustomers },
      { count: recentActivity },
      { data: topProducts },
      { data: salesByChannel },
    ] = await Promise.all([
      // 1. Current Orders (Expanded for multiple uses)
      supabase
        .from('orders')
        .select(
          'total, created_at, payment_status, id, customer_name, customer_email, source'
        )
        .eq('merchant_id', merchant.id)
        .gte('created_at', currentPeriodStart.toISOString())
        .lte('created_at', currentPeriodEnd.toISOString())
        .order('created_at', { ascending: false }),

      // 2. Previous Orders (for Comparison)
      supabase
        .from('orders')
        .select('total')
        .eq('merchant_id', merchant.id)
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', previousPeriodEnd.toISOString()),

      // 3. Total Customers
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id),

      // 4. Previous Customers (for Comparison)
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .lt('created_at', previousPeriodEnd.toISOString()),

      // 5. Recent Activity (Active Now)
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),

      // 6. Top Products (by revenue in period)
      supabase
        .from('order_items')
        .select(
          'product_id, product_name, quantity, unit_price, orders!inner(merchant_id, created_at)'
        )
        .eq('orders.merchant_id', merchant.id)
        .gte('orders.created_at', currentPeriodStart.toISOString())
        .lte('orders.created_at', currentPeriodEnd.toISOString())
        .limit(100),

      // 7. Sales by Channel (aggregate from orders)
      supabase
        .from('orders')
        .select('source, total')
        .eq('merchant_id', merchant.id)
        .gte('created_at', currentPeriodStart.toISOString())
        .lte('created_at', currentPeriodEnd.toISOString()),
    ]);

    // Calculate metrics
    const currentRevenue =
      currentOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const previousRevenue =
      previousOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const revenueChange =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    const currentSalesCount = currentOrders?.length || 0;
    const previousSalesCount = previousOrders?.length || 0;
    const salesChange =
      previousSalesCount > 0
        ? ((currentSalesCount - previousSalesCount) / previousSalesCount) * 100
        : 0;

    const customersChange =
      previousCustomers && previousCustomers > 0
        ? (((totalCustomers || 0) - previousCustomers) / previousCustomers) *
          100
        : 0;

    // Calculate chart data
    const daysDiff = Math.ceil(duration / (1000 * 60 * 60 * 24));
    const isMonthly = daysDiff > 60;
    const chartData = [];

    if (isMonthly) {
      const startMonth = new Date(currentPeriodStart);
      startMonth.setDate(1);
      while (startMonth <= currentPeriodEnd) {
        const monthEnd = new Date(
          startMonth.getFullYear(),
          startMonth.getMonth() + 1,
          0
        );
        const periodEnd =
          monthEnd > currentPeriodEnd ? currentPeriodEnd : monthEnd;
        const periodOrders =
          currentOrders?.filter((order) => {
            const orderDate = new Date(order.created_at);
            return orderDate >= startMonth && orderDate <= periodEnd;
          }) || [];
        const revenue = periodOrders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        chartData.push({
          month: startMonth.toLocaleString('default', {
            month: 'short',
            year: '2-digit',
          }),
          desktop: Math.round(revenue * 0.6),
          mobile: Math.round(revenue * 0.4),
        });
        startMonth.setMonth(startMonth.getMonth() + 1);
      }
    } else {
      const currentDay = new Date(currentPeriodStart);
      while (currentDay <= currentPeriodEnd) {
        const nextDay = new Date(currentDay);
        nextDay.setDate(currentDay.getDate() + 1);
        const periodOrders =
          currentOrders?.filter((order) => {
            const orderDate = new Date(order.created_at);
            return orderDate >= currentDay && orderDate < nextDay;
          }) || [];
        const revenue = periodOrders.reduce(
          (sum, order) => sum + (order.total || 0),
          0
        );
        chartData.push({
          day: currentDay.toLocaleString('default', {
            weekday: 'short',
            day: 'numeric',
          }),
          desktop: Math.round(revenue * 0.6),
          mobile: Math.round(revenue * 0.4),
        });
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }

    // Format recent sales (Derived from currentOrders)
    const recentSales =
      currentOrders?.slice(0, 5).map((order) => ({
        id: order.id,
        name: order.customer_name || 'Customer',
        email: order.customer_email || '',
        amount: order.total || 0,
        avatar: 'avatar-1',
      })) || [];

    // Calculate AOV
    const averageOrderValue =
      currentSalesCount > 0 ? currentRevenue / currentSalesCount : 0;
    const previousAov =
      previousSalesCount > 0 ? previousRevenue / previousSalesCount : 0;
    const aovChange =
      previousAov > 0
        ? ((averageOrderValue - previousAov) / previousAov) * 100
        : 0;

    // Calculate Gross Profit Margin (Mock 40%)
    const grossMargin = 40;
    const previousGrossMargin = 38;
    const grossMarginChange = grossMargin - previousGrossMargin;

    // Calculate LTV
    const ltv =
      (totalCustomers || 0) > 0 ? currentRevenue / (totalCustomers || 0) : 0;
    const previousLtv =
      (previousCustomers || 0) > 0
        ? previousRevenue / (previousCustomers || 0)
        : 0;
    const ltvChange =
      previousLtv > 0 ? ((ltv - previousLtv) / previousLtv) * 100 : 0;

    // Calculate Refund Rate (Derived from currentOrders)
    const refundedOrdersCount =
      currentOrders?.filter((o) => o.payment_status === 'refunded').length || 0;
    const refundRate =
      currentSalesCount > 0
        ? (refundedOrdersCount / currentSalesCount) * 100
        : 0;
    const previousRefundRate = 2.5;
    const refundRateChange = refundRate - previousRefundRate;

    // Aggregate top products by revenue
    const productRevenue = new Map<
      string,
      { name: string; revenue: number; units: number }
    >();
    topProducts?.forEach((item) => {
      const existing = productRevenue.get(item.product_id) || {
        name: item.product_name,
        revenue: 0,
        units: 0,
      };
      existing.revenue += (item.quantity || 1) * (item.unit_price || 0);
      existing.units += item.quantity || 1;
      productRevenue.set(item.product_id, existing);
    });
    const topProductsAggregated = Array.from(productRevenue.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        revenue: data.revenue,
        units: data.units,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Aggregate sales by channel
    const channelRevenue = new Map<string, number>();
    salesByChannel?.forEach((order) => {
      const channel = order.source || 'Direct';
      channelRevenue.set(
        channel,
        (channelRevenue.get(channel) || 0) + (order.total || 0)
      );
    });
    const salesByChannelAggregated = Array.from(channelRevenue.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const responseData = {
      summary: {
        revenue: { value: currentRevenue, change: revenueChange },
        customers: { value: totalCustomers || 0, change: customersChange },
        sales: { value: currentSalesCount, change: salesChange },
        activeNow: { value: recentActivity || 0, change: 0 },
        aov: { value: averageOrderValue, change: aovChange },
        grossMargin: { value: grossMargin, change: grossMarginChange },
        ltv: { value: ltv, change: ltvChange },
        refundRate: { value: refundRate, change: refundRateChange },
      },
      chartData,
      recentSales,
      topProducts: topProductsAggregated,
      salesByChannel: salesByChannelAggregated,
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
