import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  buildBusinessTypeBreakdowns,
  buildOrderStatusBreakdowns,
  buildPaymentMethodBreakdowns,
} from '@/lib/admin-analytics-breakdowns';
import { getAdminMerchantHealthRows } from '@/lib/admin-merchant-health';
import { revalidateAnalytics } from '@/lib/cache-revalidation';
import { getCachedPlatformAnalytics } from '@/lib/cached-data';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { adminAnalyticsQuerySchema } from '@/schemas/admin-analytics-query';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';
import type {
  DailyGmvData,
  MerchantActivationStage,
  OrderStatusBreakdown,
  PaymentMethodBreakdown,
  PlatformAnalytics,
  SalesChannelBreakdown,
  SignupSourceBreakdown,
} from '@/types/analytics';

type PlatformAnalyticsResponse = PlatformAnalytics;

interface MerchantProfileRow {
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_code: string | null;
  business_name: string | null;
  business_type: string | null;
  id: string;
  is_published: boolean | null;
  kyc_status: string | null;
  paystack_subaccount_code: string | null;
  signup_source: 'web' | 'ios' | 'android';
  slug: string | null;
  support_email: string | null;
  support_phone: string | null;
}

interface OrderChannelRow {
  merchant_id: string;
  payment_method: string | null;
  payment_status: string | null;
  shipping_status: string | null;
  source: string | null;
  total: number | string | null;
}

interface PaidOrderMerchantRow {
  merchant_id: string;
}

interface ProductMerchantRow {
  merchant_id: string;
}

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
      merchantProfilesResult,
      topMerchantsResult,
    ] = await Promise.all([
      supabase.rpc('get_admin_platform_daily_summary', {
        p_start_date: startDateStr,
        p_end_date: new Date().toISOString().split('T')[0],
      }),
      getAdminMerchantHealthRows(supabase),
      supabase.rpc('get_admin_platform_growth', { p_limit: 2 }),
      supabase
        .from('merchants')
        .select(
          [
            'id',
            'bank_account_name',
            'bank_account_number',
            'bank_code',
            'business_name',
            'business_type',
            'is_published',
            'kyc_status',
            'paystack_subaccount_code',
            'signup_source',
            'slug',
            'support_email',
            'support_phone',
          ].join(', ')
        ),
      supabase.rpc('get_admin_top_merchants'),
    ]);
    const merchantProfiles = (merchantProfilesResult.data ||
      []) as unknown as MerchantProfileRow[];
    const merchantIds = merchantProfiles.map((merchant) => merchant.id);
    const [paidOrdersResult, periodOrdersResult, productsResult] =
      merchantIds.length > 0
        ? await Promise.all([
            supabase
              .from('orders')
              .select('merchant_id')
              .eq('payment_status', 'paid')
              .in('merchant_id', merchantIds),
            supabase
              .from('orders')
              .select(
                'merchant_id, payment_method, payment_status, shipping_status, source, total'
              )
              .in('merchant_id', merchantIds)
              .gte('created_at', startDateStr),
            supabase
              .from('products')
              .select('merchant_id')
              .in('merchant_id', merchantIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];
    const queryError =
      dailySummaryResult.error ||
      merchantHealthResult.error ||
      growthResult.error ||
      merchantProfilesResult.error ||
      productsResult.error ||
      paidOrdersResult.error ||
      periodOrdersResult.error ||
      topMerchantsResult.error;
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
    const totalOrders = Number(currentStats.totalOrders) || 0;
    const previousOrders = Number(prevStats.totalOrders) || 0;
    const avgOrderValue = totalOrders > 0 ? totalGmv / totalOrders : 0;
    const previousAvgOrderValue =
      previousOrders > 0 ? previousGmv / previousOrders : 0;
    const gmvChange =
      previousGmv > 0 ? ((totalGmv - previousGmv) / previousGmv) * 100 : 0;
    const orderChange =
      previousOrders > 0
        ? ((totalOrders - previousOrders) / previousOrders) * 100
        : totalOrders > 0
          ? 100
          : 0;
    const aovChange =
      previousAvgOrderValue > 0
        ? ((avgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) *
          100
        : avgOrderValue > 0
          ? 100
          : 0;
    const dailyData = dailySummaryResult.data || [];
    const healthData = ((merchantHealthResult.data as
      | AdminMerchantHealthRow[]
      | null) ?? []) as AdminMerchantHealthRow[];
    const allPaidOrders = (paidOrdersResult.data ||
      []) as PaidOrderMerchantRow[];
    const periodOrders = (periodOrdersResult.data || []) as OrderChannelRow[];
    const allProducts = (productsResult.data || []) as ProductMerchantRow[];
    const merchantHealth = {
      healthy: healthData.filter((h) => h.health_status === 'healthy').length,
      atRisk: healthData.filter((h) => h.health_status === 'at_risk').length,
      churned: healthData.filter((h) => h.health_status === 'churned').length,
      new: healthData.filter((h) => h.health_status === 'new').length,
    };
    const paidMerchantIds = new Set(
      allPaidOrders.map((order) => order.merchant_id)
    );
    const productMerchantIds = new Set(
      allProducts.map((product) => product.merchant_id)
    );
    const totalChannelOrders = periodOrders.length;
    const grossGmv = periodOrders.reduce(
      (sum, order) => sum + (Number(order.total) || 0),
      0
    );
    const totalChannelGmv = periodOrders.reduce(
      (sum, order) =>
        order.payment_status === 'paid'
          ? sum + (Number(order.total) || 0)
          : sum,
      0
    );
    const salesByChannelMap = new Map<
      string,
      { channel: string; gmv: number; orders: number }
    >();
    for (const order of periodOrders) {
      const channel = order.source?.trim() || 'unknown';
      const current = salesByChannelMap.get(channel) ?? {
        channel,
        gmv: 0,
        orders: 0,
      };
      current.orders += 1;
      if (order.payment_status === 'paid') {
        current.gmv += Number(order.total) || 0;
      }
      salesByChannelMap.set(channel, current);
    }
    const salesByChannel: SalesChannelBreakdown[] = Array.from(
      salesByChannelMap.values()
    )
      .sort((left, right) => right.gmv - left.gmv || right.orders - left.orders)
      .map((channel) => ({
        ...channel,
        shareOfGmv:
          totalChannelGmv > 0 ? (channel.gmv / totalChannelGmv) * 100 : 0,
        shareOfOrders:
          totalChannelOrders > 0
            ? (channel.orders / totalChannelOrders) * 100
            : 0,
      }));
    const paymentStatuses: OrderStatusBreakdown[] = buildOrderStatusBreakdowns(
      periodOrders,
      'payment'
    );
    const shippingStatuses: OrderStatusBreakdown[] = buildOrderStatusBreakdowns(
      periodOrders,
      'shipping'
    );
    const paymentMethods: PaymentMethodBreakdown[] =
      buildPaymentMethodBreakdowns(periodOrders);
    const totalMerchants =
      merchantProfiles.length > 0 ? merchantProfiles.length : healthData.length;
    const completionRate = (count: number) =>
      totalMerchants > 0 ? (count / totalMerchants) * 100 : 0;
    const businessTypes = buildBusinessTypeBreakdowns(
      merchantProfiles.map((merchant) => merchant.business_type),
      totalMerchants
    );
    const categorizedMerchants = businessTypes
      .filter((businessType) => businessType.classification === 'configured')
      .reduce((sum, businessType) => sum + businessType.merchants, 0);
    const configuredMerchants = merchantProfiles.filter(
      (merchant) => merchant.business_name?.trim() && merchant.slug?.trim()
    ).length;
    const supportReadyMerchants = merchantProfiles.filter(
      (merchant) =>
        merchant.support_email?.trim() || merchant.support_phone?.trim()
    ).length;
    const payoutReadyMerchants = merchantProfiles.filter((merchant) => {
      const hasBankDetails =
        merchant.bank_account_name?.trim() &&
        merchant.bank_account_number?.trim() &&
        merchant.bank_code?.trim();

      return Boolean(
        hasBankDetails || merchant.paystack_subaccount_code?.trim()
      );
    }).length;
    const publishedMerchants = merchantProfiles.filter(
      (merchant) => merchant.is_published
    ).length;
    const verifiedMerchants = merchantProfiles.filter(
      (merchant) => merchant.kyc_status === 'verified'
    ).length;
    const merchantActivation: MerchantActivationStage[] = [
      {
        key: 'signed_up',
        label: 'Signed Up',
        merchants: totalMerchants,
        completionRate: completionRate(totalMerchants),
        description: 'All merchant records',
      },
      {
        key: 'business_type_set',
        label: 'Business Type Set',
        merchants: categorizedMerchants,
        completionRate: completionRate(categorizedMerchants),
        description: 'Merchants categorized during onboarding',
      },
      {
        key: 'store_configured',
        label: 'Store Configured',
        merchants: configuredMerchants,
        completionRate: completionRate(configuredMerchants),
        description: 'Merchants with business name and storefront slug',
      },
      {
        key: 'support_ready',
        label: 'Support Ready',
        merchants: supportReadyMerchants,
        completionRate: completionRate(supportReadyMerchants),
        description: 'Merchants with customer-facing support contact details',
      },
      {
        key: 'products_added',
        label: 'Products Added',
        merchants: productMerchantIds.size,
        completionRate: completionRate(productMerchantIds.size),
        description: 'Merchants with at least one product in catalog',
      },
      {
        key: 'payout_ready',
        label: 'Payout Ready',
        merchants: payoutReadyMerchants,
        completionRate: completionRate(payoutReadyMerchants),
        description: 'Merchants with payout details configured',
      },
      {
        key: 'published',
        label: 'Published',
        merchants: publishedMerchants,
        completionRate: completionRate(publishedMerchants),
        description: 'Stores currently live for shoppers',
      },
      {
        key: 'kyc_verified',
        label: 'KYC Verified',
        merchants: verifiedMerchants,
        completionRate: completionRate(verifiedMerchants),
        description: 'Merchants cleared for compliance review',
      },
      {
        key: 'first_paid_order',
        label: 'First Paid Order',
        merchants: paidMerchantIds.size,
        completionRate: completionRate(paidMerchantIds.size),
        description: 'Merchants with at least one paid order',
      },
    ];

    // Process signup source breakdown
    const signupSourceCounts = new Map<string, number>();
    for (const merchant of merchantProfiles) {
      const source = merchant.signup_source || 'web';
      signupSourceCounts.set(source, (signupSourceCounts.get(source) ?? 0) + 1);
    }
    const signupSources: SignupSourceBreakdown[] = (
      ['web', 'ios', 'android'] as const
    ).map((source) => ({
      source,
      merchants: signupSourceCounts.get(source) ?? 0,
      shareOfMerchants: completionRate(signupSourceCounts.get(source) ?? 0),
    }));

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
    const topMerchants = (
      (topMerchantsResult.data || []) as Array<{
        merchant_id: string;
        business_name: string | null;
        total_gmv: number;
        total_orders: number;
      }>
    ).map((m) => ({
      id: m.merchant_id,
      name: m.business_name || 'Unnamed Store',
      gmv: Number(m.total_gmv) || 0,
      orders: Number(m.total_orders) || 0,
    }));
    const dailyGmv: DailyGmvData[] = (
      dailyData as Array<{
        sale_date: string;
        platform_gmv: number;
        total_orders: number;
        active_merchants: number;
      }>
    ).map((d) => ({
      date: d.sale_date,
      gmv: Number(d.platform_gmv) || 0,
      orders: Number(d.total_orders) || 0,
      merchants: Number(d.active_merchants) || 0,
    }));
    const response: PlatformAnalyticsResponse = {
      summary: {
        totalGmv,
        grossGmv,
        gmvChange,
        orderChange,
        activeMerchants: Number(currentStats.activeMerchants) || 0,
        totalMerchants,
        totalOrders,
        grossOrders: totalChannelOrders,
        avgOrderValue,
        aovChange,
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
      salesByChannel,
      paymentStatuses,
      shippingStatuses,
      paymentMethods,
      merchantActivation,
      businessTypes,
      signupSources,
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
    // `refresh_platform_analytics_views` is locked to service_role per the
    // 20260428071421 advisor cleanup (no internal authz; refresh is
    // expensive enough to be a DoS surface). Route-level admin gating
    // above is the trust boundary; call via the admin client.
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.rpc(
      'refresh_platform_analytics_views'
    );

    if (error) {
      console.error('Refresh error:', error);
      return NextResponse.json(
        { error: 'Failed to refresh analytics views' },
        { status: 500 }
      );
    }

    revalidateAnalytics();

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
