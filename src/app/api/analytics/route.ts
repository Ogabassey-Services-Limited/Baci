import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/analytics?timeFrame=weekly|monthly
 * Get real-time analytics for merchant dashboard
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeFrame = searchParams.get('timeFrame') || 'weekly';

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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Calculate date ranges
    const now = new Date();
    const currentPeriodStart = new Date();
    const previousPeriodStart = new Date();
    const previousPeriodEnd = new Date();

    if (timeFrame === 'weekly') {
      // Current week (last 7 days)
      currentPeriodStart.setDate(now.getDate() - 7);
      // Previous week (14-7 days ago)
      previousPeriodStart.setDate(now.getDate() - 14);
      previousPeriodEnd.setDate(now.getDate() - 7);
    } else {
      // Current month (last 30 days)
      currentPeriodStart.setDate(now.getDate() - 30);
      // Previous month (60-30 days ago)
      previousPeriodStart.setDate(now.getDate() - 60);
      previousPeriodEnd.setDate(now.getDate() - 30);
    }

    // Fetch orders for current period
    const { data: currentOrders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('merchant_id', merchant.id)
      .gte('created_at', currentPeriodStart.toISOString())
      .order('created_at', { ascending: false });

    // Fetch orders for previous period (for comparison)
    const { data: previousOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('merchant_id', merchant.id)
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', previousPeriodEnd.toISOString());

    // Fetch total customers
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'only', head: true })
      .eq('merchant_id', merchant.id);

    // Fetch customers from previous period for comparison
    const { count: previousCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'only', head: true })
      .eq('merchant_id', merchant.id)
      .lt('created_at', previousPeriodEnd.toISOString());

    // Calculate metrics
    const currentRevenue = currentOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const previousRevenue = previousOrders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const currentSalesCount = currentOrders?.length || 0;
    const previousSalesCount = previousOrders?.length || 0;
    const salesChange = previousSalesCount > 0
      ? ((currentSalesCount - previousSalesCount) / previousSalesCount) * 100
      : 0;

    const customersChange = previousCustomers && previousCustomers > 0
      ? (((totalCustomers || 0) - previousCustomers) / previousCustomers) * 100
      : 0;

    // Calculate chart data grouped by day/month
    const chartData = [];
    const dataPoints = timeFrame === 'weekly' ? 7 : 6; // 7 days or 6 months

    for (let i = dataPoints - 1; i >= 0; i--) {
      const periodStart = new Date();
      const periodEnd = new Date();

      if (timeFrame === 'weekly') {
        periodStart.setDate(now.getDate() - i - 1);
        periodEnd.setDate(now.getDate() - i);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
      } else {
        periodStart.setMonth(now.getMonth() - i);
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setMonth(now.getMonth() - i + 1);
        periodEnd.setDate(0);
        periodEnd.setHours(23, 59, 59, 999);
      }

      const periodOrders = currentOrders?.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= periodStart && orderDate <= periodEnd;
      }) || [];

      const revenue = periodOrders.reduce((sum, order) => sum + (order.total || 0), 0);

      chartData.push({
        [timeFrame === 'weekly' ? 'day' : 'month']: timeFrame === 'weekly'
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][periodStart.getDay()]
          : periodStart.toLocaleString('default', { month: 'long' }),
        desktop: Math.round(revenue * 0.6), // Assume 60% desktop
        mobile: Math.round(revenue * 0.4),  // Assume 40% mobile
      });
    }

    // Get recent sales (last 5 orders)
    const recentSales = currentOrders?.slice(0, 5).map((order) => ({
      id: order.id,
      name: order.customer_name || 'Customer',
      email: order.customer_email || '',
      amount: order.total || 0,
      avatar: 'avatar-1', // Could enhance with actual customer data
    })) || [];

    // Active now (simplified - count orders in last hour)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { count: recentActivity } = await supabase
      .from('orders')
      .select('*', { count: 'only', head: true })
      .eq('merchant_id', merchant.id)
      .gte('created_at', oneHourAgo.toISOString());

    return NextResponse.json({
      summary: {
        revenue: {
          value: currentRevenue,
          change: revenueChange,
        },
        customers: {
          value: totalCustomers || 0,
          change: customersChange,
        },
        sales: {
          value: currentSalesCount,
          change: salesChange,
        },
        activeNow: {
          value: recentActivity || 0,
          change: 0, // Could compare to previous hour
        },
      },
      chartData,
      recentSales,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
