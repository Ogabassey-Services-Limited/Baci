import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getCachedPlatformAnalytics } from '@/lib/cached-data';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { adminAnalyticsQuerySchema } from '@/schemas/admin-analytics-query';
import type { DailyGmvData, PlatformAnalytics } from '@/types/analytics';

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parseResult = adminAnalyticsQuerySchema.safeParse({
      period: searchParams.get('period') ?? undefined,
    });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error:
            parseResult.error.issues[0]?.message ?? 'Invalid period parameter',
          code: 'INVALID_PERIOD',
        },
        { status: 400 }
      );
    }

    const { period } = parseResult.data;
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();
    if (adminCheckError) {
      console.error('Admin analytics admin check error:', adminCheckError);
      return NextResponse.json(
        { error: 'Failed to verify admin access' },
        { status: 500 }
      );
    }

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
    const periodDays =
      period === '7d'
        ? 7
        : period === '90d'
          ? 90
          : period === 'all'
            ? 3650
            : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startDateStr = startDate.toISOString().split('T')[0];

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);
    const previousStartDateStr = previousStartDate.toISOString().split('T')[0];
    const [
      dailySummaryResult,
      merchantHealthResult,
      growthResult,
      topMerchantsResult,
      totalMerchantsResult,
    ] = await Promise.all([
      supabase
        .from('platform_daily_summary')
        .select('sale_date, platform_gmv, total_orders, active_merchants')
        .gte('sale_date', startDateStr)
        .order('sale_date', { ascending: true }),
      supabase.from('merchant_health').select('health_status'),
      supabase
        .from('platform_growth')
        .select('month, new_merchants')
        .order('month', { ascending: false })
        .limit(2),
      supabase
        .from('top_merchants')
        .select('merchant_id, business_name, total_gmv, total_orders')
        .order('total_gmv', { ascending: false })
        .limit(10),
      supabase
        .from('merchants')
        .select('id', { count: 'exact', head: true })
        .not('business_name', 'is', null)
        .not('slug', 'is', null),
    ]);
    const queryError =
      dailySummaryResult.error ||
      merchantHealthResult.error ||
      growthResult.error ||
      topMerchantsResult.error ||
      totalMerchantsResult.error;
    if (queryError) {
      console.error('Admin analytics query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

    const endDateStr = new Date().toISOString().split('T')[0];
    const [summaryData, prevSummaryData] = await Promise.all([
      getCachedPlatformAnalytics(startDateStr, endDateStr),
      getCachedPlatformAnalytics(previousStartDateStr, startDateStr),
    ]);

    if (!summaryData || !prevSummaryData) {
      throw new Error('Failed to fetch platform analytics summary');
    }

    interface PlatformAnalyticsSummary {
      totalGmv: number;
      activeMerchants: number;
      totalOrders: number;
      platformRevenue: number;
      processorFees: number;
      netToMerchants: number;
      [key: string]: unknown;
    }

    const currentStats = summaryData as PlatformAnalyticsSummary;
    const prevStats = prevSummaryData as PlatformAnalyticsSummary;

    const totalGmv = Number(currentStats.totalGmv) || 0;
    const previousGmv = Number(prevStats.totalGmv) || 0;
    const gmvChange =
      previousGmv > 0 ? ((totalGmv - previousGmv) / previousGmv) * 100 : 0;
    const dailyData = dailySummaryResult.data || [];
    const healthData = merchantHealthResult.data || [];
    const merchantHealth = {
      healthy: healthData.filter((h) => h.health_status === 'healthy').length,
      atRisk: healthData.filter((h) => h.health_status === 'at_risk').length,
      churned: healthData.filter((h) => h.health_status === 'churned').length,
      new: healthData.filter((h) => h.health_status === 'new').length,
    };

    // Process growth metrics
    const growthData = growthResult.data || [];
    const currentMonth = growthData[0];
    const previousMonth = growthData[1];
    const newMerchantsThisMonth = currentMonth?.new_merchants || 0;
    const merchantGrowthRate = previousMonth?.new_merchants
      ? ((newMerchantsThisMonth - previousMonth.new_merchants) /
          previousMonth.new_merchants) *
        100
      : newMerchantsThisMonth > 0
        ? 100
        : 0;
    const topMerchants = (topMerchantsResult.data || []).map((m) => ({
      id: m.merchant_id,
      name: m.business_name || 'Unnamed Store',
      gmv: Number(m.total_gmv) || 0,
      orders: Number(m.total_orders) || 0,
    }));
    const dailyGmv: DailyGmvData[] = dailyData.map((d) => ({
      date: d.sale_date,
      gmv: Number(d.platform_gmv) || 0,
      orders: Number(d.total_orders) || 0,
      merchants: Number(d.active_merchants) || 0,
    }));
    const response: PlatformAnalyticsResponse = {
      summary: {
        totalGmv,
        gmvChange,
        activeMerchants: Number(currentStats.activeMerchants) || 0,
        totalMerchants: totalMerchantsResult.count || 0,
        totalOrders: Number(currentStats.totalOrders) || 0,
        avgGmvPerMerchant:
          Number(currentStats.activeMerchants) > 0
            ? totalGmv / Number(currentStats.activeMerchants)
            : 0,
        platformRevenue: Number(currentStats.platformRevenue) || 0,
        processorFees: Number(currentStats.processorFees) || 0,
        netToMerchants: Number(currentStats.netToMerchants) || 0,
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
export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantId)
      .maybeSingle();
    if (adminCheckError) {
      console.error(
        'Admin analytics refresh admin check error:',
        adminCheckError
      );
      return NextResponse.json(
        { error: 'Failed to verify admin access' },
        { status: 500 }
      );
    }

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
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
