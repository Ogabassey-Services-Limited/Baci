import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalyticsCategoryData } from './fetch-analytics-category-data';

const merchantId = 'merchant-1';
const from = new Date('2026-08-01T00:00:00.000Z');
const to = new Date('2026-08-07T23:59:59.999Z');

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

describe('fetchAnalyticsCategoryData', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and maps inventory alerts and forecasts for the selected merchant', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/inventory/alerts?status=active')) {
        return response({
          alerts: [
            {
              alert_type: 'low_stock',
              current_stock: 2,
              id: 'alert-1',
              products: { name: 'Phone' },
              status: 'active',
            },
          ],
        });
      }

      if (url.includes('/api/inventory/alerts?status=resolved')) {
        return response({ alerts: [{ id: 'resolved-alert' }] });
      }

      return response({
        forecasts: [
          {
            avgDailySales: 1,
            currentStock: 2,
            daysOfStock: 2,
            productId: 'product-1',
            productName: 'Phone',
            salesTrend: 'increasing',
          },
        ],
        summary: { critical: 1, outOfStock: 0, warning: 2 },
      });
    });

    const result = await fetchAnalyticsCategoryData({
      category: 'inventory',
      from,
      merchantId,
      signal: new AbortController().signal,
      to,
    });

    expect(result).toMatchObject({
      inventoryAlerts: [
        {
          alert_type: 'low_stock',
          current_stock: 2,
          id: 'alert-1',
          product_name: 'Phone',
        },
      ],
      inventoryForecasts: [
        {
          avg_daily_sales: 1,
          current_stock: 2,
          days_of_stock: 2,
          product_id: 'product-1',
          product_name: 'Phone',
          sales_trend: 'increasing',
        },
      ],
      lowStockCount: 3,
      outOfStockCount: 0,
      resolvedInventoryAlertCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toEqual(
        expect.objectContaining({
          headers: { 'x-baci-merchant-id': merchantId },
        })
      );
    }
  });

  it('maps the customer segment summary into dashboard segment metrics', async () => {
    fetchMock.mockResolvedValue(
      response({
        summary: [
          {
            avg_clv: 300,
            customer_count: 2,
            segment_name: 'Champions',
            total_revenue: 900,
          },
          {
            avg_clv: 80,
            customer_count: 3,
            segment_name: 'At Risk',
            total_revenue: 240,
          },
        ],
      })
    );

    await expect(
      fetchAnalyticsCategoryData({
        category: 'segments',
        from,
        merchantId,
        signal: new AbortController().signal,
        to,
      })
    ).resolves.toMatchObject({
      segmentSummary: {
        at_risk_count: 3,
        champions_count: 2,
        segments: expect.arrayContaining([
          expect.objectContaining({ segment: 'Champions', total_revenue: 900 }),
        ]),
        total_customers: 5,
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/customers/segments?limit=100'
    );
  });

  it('loads ad conversion analytics for the selected date range', async () => {
    fetchMock.mockResolvedValue(
      response({
        configuredPlatforms: 2,
        details: {
          ordersWithClickIds: 4,
          ordersWithLDU: 1,
          ordersWithTracking: 5,
        },
        offlineConversionsEnabled: true,
        googleAds: {
          accountName: 'Baci reporting account',
          connectionStatus: 'connected',
          currency: 'NGN',
          metrics: {
            clicks: 48,
            ctr: 2.4,
            impressions: 2000,
            spend: 12500,
          },
        },
        platforms: [
          {
            clickAttributed: 4,
            configured: true,
            conversions: 2,
            name: 'Facebook',
            revenue: 500,
          },
        ],
        socialAds: {
          attributionNotice: 'Provider attribution stays separate.',
          mixedCurrencies: false,
          providers: [
            {
              accountName: 'Baci Meta',
              accountTimezone: 'Africa/Lagos',
              clicksLabel: 'Clicks',
              connectionStatus: 'connected',
              conversionsLabel: 'Meta-attributed conversions',
              dataStatus: 'ready',
              displayName: 'Meta Ads',
              freshness: 'fresh',
              isStale: false,
              lastSyncedAt: '2026-08-22T09:00:00.000Z',
              metrics: {
                clicks: '20',
                conversions: '2',
                endDate: '2026-08-22',
                impressions: '1000',
                reach: '800',
                spendByCurrency: [
                  { currencyCode: 'NGN', spendAmountDecimal: '12500.50' },
                ],
                startDate: '2026-08-01',
              },
              needsAccountSelection: false,
              provider: 'meta_ads',
            },
          ],
          spendByCurrency: [
            { currencyCode: 'NGN', spendAmountDecimal: '12500.50' },
          ],
        },
        summary: {
          clickAttributionRate: 40,
          lduRate: 10,
          totalAttributedRevenue: 500,
          totalConversions: 2,
          totalOrders: 10,
          trackingRate: 50,
        },
      })
    );

    const result = await fetchAnalyticsCategoryData({
      category: 'ads',
      from,
      merchantId,
      signal: new AbortController().signal,
      to,
    });

    expect(result.adAnalytics?.summary.totalConversions).toBe(2);
    expect(result.adAnalytics?.details.ordersWithTracking).toBe(5);
    expect(result.adAnalytics?.googleAds).toMatchObject({
      accountName: 'Baci reporting account',
      connectionStatus: 'connected',
      currency: 'NGN',
      metrics: {
        clicks: 48,
        ctr: 2.4,
        impressions: 2000,
        spend: 12500,
      },
    });
    expect(result.adAnalytics?.platforms[0]?.name).toBe('Facebook');
    expect(result.adAnalytics?.socialAds).toMatchObject({
      mixedCurrencies: false,
      providers: [
        {
          metrics: {
            conversions: '2',
            spendByCurrency: [
              { currencyCode: 'NGN', spendAmountDecimal: '12500.50' },
            ],
          },
          provider: 'meta_ads',
        },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/analytics/ads?');
    expect(String(url)).toContain(
      `startDate=${encodeURIComponent(from.toISOString())}`
    );
    expect(String(url)).toContain(
      `endDate=${encodeURIComponent(to.toISOString())}`
    );
    expect(init).toEqual(
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': merchantId },
      })
    );
  });

  it('maps the analytics snapshot daily rows into Google Ads reporting metrics', async () => {
    fetchMock.mockResolvedValue(
      response({
        googleAds: {
          connected: true,
          currencyCode: 'NGN',
          customerId: null,
          daily: [
            {
              clicks: 12,
              conversions: 2,
              currencyCode: 'NGN',
              date: '2026-08-20',
              fetchedAt: '2026-08-21T10:00:00.000Z',
              impressions: 1200,
              spend: 500,
              spendMicros: '500000000',
            },
          ],
          lastSyncedAt: null,
        },
      })
    );

    const result = await fetchAnalyticsCategoryData({
      category: 'ads',
      from,
      merchantId,
      signal: new AbortController().signal,
      to,
    });

    expect(result.adAnalytics?.googleAds).toMatchObject({
      connectionStatus: 'connected',
      currency: 'NGN',
      needsAccountSelection: true,
      metrics: {
        clicks: 12,
        conversions: 2,
        impressions: 1200,
        spend: 500,
      },
    });
  });

  it('adds a cache-bust token when ad reporting is refreshed', async () => {
    fetchMock.mockResolvedValue(response({}));

    await fetchAnalyticsCategoryData({
      category: 'ads',
      from,
      merchantId,
      refreshKey: 3,
      signal: new AbortController().signal,
      to,
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('cacheBust=3');
  });

  it('preserves mixed-currency and stale social reporting without changing legacy attribution', async () => {
    fetchMock.mockResolvedValue(
      response({
        platforms: [
          {
            clickAttributed: 3,
            configured: true,
            conversions: 1,
            name: 'TikTok',
            revenue: 5000,
          },
        ],
        socialAds: {
          attributionNotice: 'Provider attribution stays separate.',
          mixedCurrencies: true,
          providers: [
            {
              connectionStatus: 'connected',
              dataStatus: 'ready',
              displayName: 'TikTok Ads',
              freshness: 'stale',
              isStale: true,
              provider: 'tiktok_ads',
            },
          ],
          spendByCurrency: [
            { currencyCode: 'NGN', spendAmountDecimal: '2000' },
            { currencyCode: 'USD', spendAmountDecimal: '5' },
          ],
        },
      })
    );

    const result = await fetchAnalyticsCategoryData({
      category: 'ads',
      from,
      merchantId,
      signal: new AbortController().signal,
      to,
    });

    expect(result.adAnalytics?.platforms[0]).toMatchObject({
      clickAttributed: 3,
      revenue: 5000,
    });
    expect(result.adAnalytics?.socialAds).toMatchObject({
      mixedCurrencies: true,
      providers: [expect.objectContaining({ freshness: 'stale' })],
      spendByCurrency: [
        { currencyCode: 'NGN', spendAmountDecimal: '2000' },
        { currencyCode: 'USD', spendAmountDecimal: '5' },
      ],
    });
  });

  it('does not fetch specialized data for categories backed by the base overview', async () => {
    const result = await fetchAnalyticsCategoryData({
      category: 'overview',
      from,
      merchantId,
      signal: new AbortController().signal,
      to,
    });

    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
