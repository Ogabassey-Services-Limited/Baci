import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { PlatformAnalytics, DailyGmvData } from '@/types/analytics';

// Re-export types for backward compatibility if needed, or just use the imported one
type PlatformAnalyticsResponse = PlatformAnalytics;

/**
 * GET /api/admin/analytics
 * Returns platform-level analytics for the admin dashboard
 * Only accessible to platform administrators
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Step 1: Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Parse period parameter
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 3650 : 30; // 10 years for 'all'
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startDateStr = startDate.toISOString().split('T')[0];

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousStartDateStr = previousStartDate.toISOString().split('T')[0];

    // Fetch all data in parallel
    const [
      dailySummaryResult,
      previousDailySummaryResult,
      merchantHealthResult,
      growthResult,
      topMerchantsResult,
      totalMerchantsResult,
      platformRevenueResult,
    ] = await Promise.all([
      // Current period daily summary
      supabase
        .from('platform_daily_summary')
        .select('*')
        .gte('sale_date', startDateStr)
        .order('sale_date', { ascending: true }),

      // Previous period for comparison
      supabase
        .from('platform_daily_summary')
        .select('*')
        .gte('sale_date', previousStartDateStr)
        .lt('sale_date', startDateStr),

      // Merchant health breakdown
      supabase
        .from('merchant_health')
        .select('health_status'),

      // Growth metrics
      supabase
        .from('platform_growth')
        .select('*')
        .order('month', { ascending: false })
        .limit(2),

      // Top merchants
      supabase
        .from('top_merchants')
        .select('*')
        .order('total_gmv', { ascending: false })
        .limit(10),

      // Total merchants count
      supabase
        .from('merchants')
        .select('id', { count: 'exact', head: true })
        .or('is_platform_admin.eq.false,is_platform_admin.is.null'),

      // Platform revenue from fees
      supabase
        .from('platform_revenue')
        .select('*')
        .gte('date', startDateStr),
    ]);

    // Process daily summary for current period
    const dailyData = dailySummaryResult.data || [];
    const totalGmv = dailyData.reduce((sum, d) => sum + (Number(d.platform_gmv) || 0), 0);
    const totalOrders = dailyData.reduce((sum, d) => sum + (Number(d.total_orders) || 0), 0);
    const activeMerchants = dailyData.length > 0
      ? Math.max(...dailyData.map(d => Number(d.active_merchants) || 0))
      : 0;
    const avgGmvPerMerchant = activeMerchants > 0 ? totalGmv / activeMerchants : 0;

    // Calculate GMV change from previous period
    const previousData = previousDailySummaryResult.data || [];
    const previousGmv = previousData.reduce((sum, d) => sum + (Number(d.platform_gmv) || 0), 0);
    const gmvChange = previousGmv > 0 ? ((totalGmv - previousGmv) / previousGmv) * 100 : 0;

    // Process merchant health breakdown
    const healthData = merchantHealthResult.data || [];
    const merchantHealth = {
      healthy: healthData.filter(h => h.health_status === 'healthy').length,
      atRisk: healthData.filter(h => h.health_status === 'at_risk').length,
      churned: healthData.filter(h => h.health_status === 'churned').length,
      new: healthData.filter(h => h.health_status === 'new').length,
    };

    // Process growth metrics
    const growthData = growthResult.data || [];
    const currentMonth = growthData[0];
    const previousMonth = growthData[1];
    const newMerchantsThisMonth = currentMonth?.new_merchants || 0;
    const merchantGrowthRate = previousMonth?.new_merchants
      ? ((newMerchantsThisMonth - previousMonth.new_merchants) / previousMonth.new_merchants) * 100
      : newMerchantsThisMonth > 0 ? 100 : 0;

    // Process top merchants
    const topMerchants = (topMerchantsResult.data || []).map(m => ({
      id: m.merchant_id,
      name: m.business_name || 'Unnamed Store',
      gmv: Number(m.total_gmv) || 0,
      orders: Number(m.total_orders) || 0,
    }));

    // Format daily GMV data for charts
    const dailyGmv: DailyGmvData[] = dailyData.map(d => ({
      date: d.sale_date,
      gmv: Number(d.platform_gmv) || 0,
      orders: Number(d.total_orders) || 0,
      merchants: Number(d.active_merchants) || 0,
    }));

    // Process platform revenue from fees
    const revenueData = platformRevenueResult.data || [];
    const platformRevenue = revenueData.reduce(
      (sum, d) => sum + (Number(d.platform_fees) || 0),
      0
    );
    const processorFees = revenueData.reduce(
      (sum, d) => sum + (Number(d.processor_fees) || 0),
      0
    );
    const netToMerchants = revenueData.reduce(
      (sum, d) => sum + (Number(d.net_to_merchants) || 0),
      0
    );

    const response: PlatformAnalyticsResponse = {
      summary: {
        totalGmv,
        gmvChange,
        activeMerchants,
        totalMerchants: totalMerchantsResult.count || 0,
        totalOrders,
        avgGmvPerMerchant,
        platformRevenue,
        processorFees,
        netToMerchants,
      },
      merchantHealth,
      growth: {
        newMerchantsThisMonth,
        merchantGrowthRate,
        gmvGrowthRate: gmvChange, // Same as GMV change for now
      },
      topMerchants,
      dailyGmv,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Platform analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/analytics/refresh
 * Refreshes the platform analytics materialized views
 * Only accessible to platform administrators
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Step 1: Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Admin role check
    const { data: merchant } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('user_id', user.id)
      .single();

    if (!merchant?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Refresh materialized views
    const { error } = await supabase.rpc('refresh_platform_analytics_views');

    if (error) {
      console.error('Refresh error:', error);
      return NextResponse.json(
        { error: 'Failed to refresh analytics views' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Platform analytics views refreshed successfully',
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Refresh analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics views' },
      { status: 500 }
    );
  }
}
