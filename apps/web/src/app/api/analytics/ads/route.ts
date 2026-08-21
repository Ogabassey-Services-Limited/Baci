import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseRequestedMerchantId } from '@/app/api/branches/branch-route-utils';
import type { AdTrackingData } from '@/lib/ad-tracking-cookies';
import { fetchAnalyticsPlatformConfig } from '@/lib/analytics/analytics-platform-config';
import { fetchAdReportingSnapshots } from '@/lib/analytics/fetch-ad-reporting-snapshots';
import { hasPermission } from '@/lib/api-auth';
import { cache, generateCacheKey } from '@/lib/cache';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { analyticsQuerySchema } from '@/schemas/analytics-query';

/**
 * Ad Conversion Analytics API
 *
 * GET /api/analytics/ads?startDate=ISO&endDate=ISO
 *
 * Returns metrics about CAPI/offline conversion tracking:
 * - Total conversions tracked
 * - Revenue attributed to each platform (Facebook, TikTok, GA4, Snapchat)
 * - Click attribution (orders with fbclid, ttclid, gclid, sccid)
 * - Platform configuration status
 */

interface PlatformStats {
  name: string;
  configured: boolean;
  conversions: number;
  revenue: number;
  clickAttributed: number; // Orders with click ID from this platform
}

// react-doctor-disable-next-line react-doctor/nextjs-no-side-effect-in-get-handler -- Process-local analytics cache write only; no user or database state is mutated by GET.
export async function GET(request: Request) {
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
    const parsedQuery = analyticsQuerySchema.safeParse({
      cacheBust: searchParams.get('cacheBust') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      startDate: searchParams.get('startDate') || undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        { code: 'INVALID_QUERY', error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    // Default to last 30 days if no dates provided
    const now = new Date();
    const endDate = parsedQuery.data.endDate
      ? new Date(parsedQuery.data.endDate)
      : now;
    const startDate = parsedQuery.data.startDate
      ? new Date(parsedQuery.data.startDate)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    // Resolve merchant context (supports both owners and staff members)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: requestedMerchant.merchantId,
    });
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'analytics', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const merchantId = merchantContext.merchantId;

    // Fetch merchant analytics config, preferring dashboard feature settings.
    const merchant = await fetchAnalyticsPlatformConfig(supabase, merchantId);

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey(
      'ad-analytics',
      merchantId,
      startDate.toISOString(),
      endDate.toISOString()
    );

    // Try cached data (5 minute TTL)
    const shouldBypassCache = parsedQuery.data.cacheBust !== undefined;
    const cachedData = shouldBypassCache
      ? undefined
      : cache.get<Record<string, unknown>>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Fetch paid orders with ad tracking data
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, ad_tracking, created_at, payment_status')
      .eq('merchant_id', merchantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Spend snapshots are optional: an unconnected merchant or a not-yet-run
    // sync must not erase the conversion analytics response. Keep the provider
    // credentials out of this projection and expose only reporting metadata.
    const { googleAds, socialAds } = await fetchAdReportingSnapshots({
      endDate: endDate.toISOString().slice(0, 10),
      merchantId,
      startDate: startDate.toISOString().slice(0, 10),
      supabase,
    });

    // Calculate platform stats
    const platformStats: Record<string, PlatformStats> = {
      facebook: {
        name: 'Facebook',
        configured: !!(
          merchant.facebook_pixel_id && merchant.facebook_capi_token
        ),
        conversions: 0,
        revenue: 0,
        clickAttributed: 0,
      },
      tiktok: {
        name: 'TikTok',
        configured: !!(
          merchant.tiktok_pixel_id && merchant.tiktok_access_token
        ),
        conversions: 0,
        revenue: 0,
        clickAttributed: 0,
      },
      ga4: {
        name: 'Google Analytics 4',
        configured: !!(merchant.google_analytics_id && merchant.ga4_api_secret),
        conversions: 0,
        revenue: 0,
        clickAttributed: 0,
      },
      snapchat: {
        name: 'Snapchat',
        configured: !!(
          merchant.snapchat_pixel_id && merchant.snapchat_capi_token
        ),
        conversions: 0,
        revenue: 0,
        clickAttributed: 0,
      },
    };

    let totalConversions = 0;
    let totalAttributedRevenue = 0;
    let ordersWithTracking = 0;
    let ordersWithClickIds = 0;
    let ordersWithLDU = 0;

    // Analyze each order
    for (const order of orders || []) {
      const tracking = order.ad_tracking as AdTrackingData | null;
      const revenue = Number(order.total) || 0;

      if (tracking) {
        ordersWithTracking++;

        // Check for LDU flag
        if (tracking.limitedDataUse) {
          ordersWithLDU++;
        }

        // Check for click IDs (attribution)
        const hasClickId = !!(
          tracking.fbclid ||
          tracking.ttclid ||
          tracking.gclid ||
          tracking.sccid
        );
        if (hasClickId) {
          ordersWithClickIds++;
        }

        // Facebook attribution
        if (tracking.fbclid || tracking.fbp) {
          platformStats.facebook.clickAttributed++;
          if (platformStats.facebook.configured) {
            platformStats.facebook.conversions++;
            platformStats.facebook.revenue += revenue;
          }
        }

        // TikTok attribution
        if (tracking.ttclid || tracking.ttp) {
          platformStats.tiktok.clickAttributed++;
          if (platformStats.tiktok.configured) {
            platformStats.tiktok.conversions++;
            platformStats.tiktok.revenue += revenue;
          }
        }

        // Google attribution
        if (tracking.gclid || tracking.gaClientId) {
          platformStats.ga4.clickAttributed++;
          if (platformStats.ga4.configured) {
            platformStats.ga4.conversions++;
            platformStats.ga4.revenue += revenue;
          }
        }

        // Snapchat attribution
        if (tracking.sccid) {
          platformStats.snapchat.clickAttributed++;
          if (platformStats.snapchat.configured) {
            platformStats.snapchat.conversions++;
            platformStats.snapchat.revenue += revenue;
          }
        }

        // Count as conversion only if the order has tracking for a configured platform
        const hasConfiguredPlatformTracking =
          (platformStats.facebook.configured &&
            (tracking.fbclid || tracking.fbp)) ||
          (platformStats.tiktok.configured &&
            (tracking.ttclid || tracking.ttp)) ||
          (platformStats.ga4.configured &&
            (tracking.gclid || tracking.gaClientId)) ||
          (platformStats.snapchat.configured && tracking.sccid);

        if (hasConfiguredPlatformTracking) {
          totalConversions++;
          totalAttributedRevenue += revenue;
        }
      }
    }

    // Calculate percentages
    const totalOrders = orders?.length || 0;
    const trackingRate =
      totalOrders > 0 ? (ordersWithTracking / totalOrders) * 100 : 0;
    const clickAttributionRate =
      totalOrders > 0 ? (ordersWithClickIds / totalOrders) * 100 : 0;
    const lduRate =
      ordersWithTracking > 0 ? (ordersWithLDU / ordersWithTracking) * 100 : 0;

    // Count configured platforms
    const configuredPlatforms = Object.values(platformStats).filter(
      (p) => p.configured
    ).length;

    const responseData = {
      // Overall status
      offlineConversionsEnabled: merchant.offline_conversions_enabled !== false,
      configuredPlatforms,

      // Summary metrics
      summary: {
        totalOrders,
        totalConversions,
        totalAttributedRevenue,
        trackingRate: Math.round(trackingRate * 10) / 10, // 1 decimal
        clickAttributionRate: Math.round(clickAttributionRate * 10) / 10,
        lduRate: Math.round(lduRate * 10) / 10,
      },

      // Per-platform breakdown
      platforms: Object.values(platformStats),

      // Detailed stats
      details: {
        ordersWithTracking,
        ordersWithClickIds,
        ordersWithLDU,
      },
      socialAds,
      ...(googleAds ? { googleAds } : {}),
    };

    // Cache for 5 minutes
    if (!shouldBypassCache) {
      cache.set(cacheKey, responseData, 300);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching ad analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
