import type { AnalyticsCategory } from '@/components/analytics/analytics-category-nav';
import type { AnalyticsData } from '@/components/analytics/draggable-analytics-grid';
import { mapGoogleAdsReporting } from './google-ads-analytics-mapper';
import { mapSocialAdsReporting } from './social-ads-analytics-mapper';

interface FetchAnalyticsCategoryDataOptions {
  category: AnalyticsCategory;
  from: Date;
  merchantId: string;
  refreshKey?: number;
  signal: AbortSignal;
  to: Date;
}

interface JsonRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

async function fetchAnalyticsJson(
  path: string,
  merchantId: string,
  signal: AbortSignal
): Promise<JsonRecord> {
  const response = await fetch(path, {
    headers: { 'x-baci-merchant-id': merchantId },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Analytics request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  return asRecord(payload) ?? {};
}

function mapInventoryAlert(alert: JsonRecord) {
  const product = asRecord(alert.products);
  return {
    alert_type: asString(alert.alert_type, 'unknown'),
    current_stock: asNumber(alert.current_stock),
    id: asString(alert.id, 'unknown-alert'),
    product_name: asString(product?.name, 'Unknown Product'),
    status: asString(alert.status, 'active'),
  };
}

function mapInventoryForecast(forecast: JsonRecord) {
  return {
    avg_daily_sales: asNumber(forecast.avgDailySales),
    current_stock: asNumber(forecast.currentStock),
    days_of_stock: asNumber(forecast.daysOfStock),
    product_id: asString(forecast.productId, 'unknown-product'),
    product_name: asString(forecast.productName, 'Unknown Product'),
    sales_trend: asString(forecast.salesTrend, 'stable'),
  };
}

async function fetchInventoryData(
  merchantId: string,
  signal: AbortSignal
): Promise<Partial<AnalyticsData>> {
  const [alertsResult, forecastResult, resolvedAlertsResult] =
    await Promise.allSettled([
      fetchAnalyticsJson(
        '/api/inventory/alerts?status=active',
        merchantId,
        signal
      ),
      fetchAnalyticsJson(
        '/api/inventory/forecast?limit=100',
        merchantId,
        signal
      ),
      fetchAnalyticsJson(
        '/api/inventory/alerts?status=resolved',
        merchantId,
        signal
      ),
    ]);

  if (
    alertsResult.status === 'rejected' &&
    forecastResult.status === 'rejected'
  ) {
    throw alertsResult.reason instanceof Error
      ? alertsResult.reason
      : new Error('Inventory analytics unavailable');
  }

  const alertsPayload =
    alertsResult.status === 'fulfilled' ? alertsResult.value : {};
  const forecastPayload =
    forecastResult.status === 'fulfilled' ? forecastResult.value : {};
  const resolvedAlertsPayload =
    resolvedAlertsResult.status === 'fulfilled'
      ? resolvedAlertsResult.value
      : {};
  const forecastSummary = asRecord(forecastPayload.summary);
  const forecasts = asArray(forecastPayload.forecasts).map(
    mapInventoryForecast
  );

  return {
    inventoryAlerts: asArray(alertsPayload.alerts).map(mapInventoryAlert),
    inventoryForecasts: forecasts,
    lowStockCount:
      asNumber(forecastSummary?.critical) + asNumber(forecastSummary?.warning),
    outOfStockCount: asNumber(forecastSummary?.outOfStock),
    resolvedInventoryAlertCount: asArray(resolvedAlertsPayload.alerts).length,
  };
}

function normalizeSegmentName(value: unknown): string {
  return asString(value, 'Unknown').trim();
}

async function fetchSegmentData(
  merchantId: string,
  signal: AbortSignal
): Promise<Partial<AnalyticsData>> {
  const payload = await fetchAnalyticsJson(
    '/api/customers/segments?limit=100',
    merchantId,
    signal
  );
  const segments = asArray(payload.summary).map((row) => ({
    avg_clv: asNumber(row.avg_clv),
    count: asNumber(row.customer_count),
    segment: normalizeSegmentName(row.segment_name),
    total_revenue: asNumber(row.total_revenue),
  }));
  const totalCustomers = segments.reduce((sum, row) => sum + row.count, 0);
  const champions = segments.find(
    (row) => row.segment.toLowerCase() === 'champions'
  );
  const atRisk = segments.filter((row) =>
    ['at risk', "can't lose them"].includes(row.segment.toLowerCase())
  );

  return {
    segmentSummary: {
      at_risk_count: atRisk.reduce((sum, row) => sum + row.count, 0),
      champions_count: champions?.count ?? 0,
      segments,
      total_customers: totalCustomers,
    },
  };
}

function mapAdPlatform(platform: JsonRecord) {
  return {
    clickAttributed: asNumber(platform.clickAttributed),
    configured: platform.configured === true,
    conversions: asNumber(platform.conversions),
    name: asString(platform.name, 'Unknown platform'),
    revenue: asNumber(platform.revenue),
  };
}

async function fetchAdAnalyticsData(
  merchantId: string,
  from: Date,
  refreshKey: number | undefined,
  to: Date,
  signal: AbortSignal
): Promise<Partial<AnalyticsData>> {
  const params = new URLSearchParams({
    endDate: to.toISOString(),
    startDate: from.toISOString(),
  });
  if (refreshKey !== undefined) {
    params.set('cacheBust', String(refreshKey));
  }
  const payload = await fetchAnalyticsJson(
    `/api/analytics/ads?${params.toString()}`,
    merchantId,
    signal
  );
  const summary = asRecord(payload.summary);
  const details = asRecord(payload.details);
  const googleAds = mapGoogleAdsReporting(payload.googleAds ?? payload.adSpend);
  const socialAds = mapSocialAdsReporting(payload.socialAds);

  return {
    adAnalytics: {
      configuredPlatforms: asNumber(payload.configuredPlatforms),
      details: {
        ordersWithClickIds: asNumber(details?.ordersWithClickIds),
        ordersWithLDU: asNumber(details?.ordersWithLDU),
        ordersWithTracking: asNumber(details?.ordersWithTracking),
      },
      googleAds,
      offlineConversionsEnabled: payload.offlineConversionsEnabled !== false,
      platforms: asArray(payload.platforms).map(mapAdPlatform),
      socialAds,
      summary: {
        clickAttributionRate: asNumber(summary?.clickAttributionRate),
        lduRate: asNumber(summary?.lduRate),
        totalAttributedRevenue: asNumber(summary?.totalAttributedRevenue),
        totalConversions: asNumber(summary?.totalConversions),
        totalOrders: asNumber(summary?.totalOrders),
        trackingRate: asNumber(summary?.trackingRate),
      },
    },
  };
}

export function fetchAnalyticsCategoryData({
  category,
  from,
  merchantId,
  refreshKey,
  signal,
  to,
}: FetchAnalyticsCategoryDataOptions): Promise<Partial<AnalyticsData>> {
  if (category === 'inventory') {
    return fetchInventoryData(merchantId, signal);
  }

  if (category === 'segments') {
    return fetchSegmentData(merchantId, signal);
  }

  if (category === 'ads') {
    return fetchAdAnalyticsData(merchantId, from, refreshKey, to, signal);
  }

  return Promise.resolve({});
}
