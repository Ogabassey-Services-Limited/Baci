import { describe, expect, it } from 'vitest';
import { buildSocialAdsAnalyticsSnapshot } from './social-ads-analytics-snapshot';

describe('buildSocialAdsAnalyticsSnapshot sync freshness', () => {
  it('hides retained rows until an active selected account completes a sync', () => {
    const snapshot = buildSocialAdsAnalyticsSnapshot({
      connections: [
        {
          account_timezone: 'UTC',
          last_synced_at: null,
          provider: 'meta_ads',
          provider_account_label: 'Baci Meta',
          provider_customer_id: 'act_1',
          status: 'active',
          token_expires_at: '2026-09-01T00:00:00.000Z',
        },
      ],
      endDate: '2026-08-22',
      spendRows: [
        {
          account_timezone: 'UTC',
          clicks: '10',
          conversions: '2',
          currency_code: 'NGN',
          fetched_at: '2026-08-22T09:00:00.000Z',
          impressions: '100',
          provider: 'meta_ads',
          provider_customer_id: 'act_1',
          reach: '80',
          spend_amount_decimal: '100',
          spend_date: '2026-08-22',
        },
      ],
      startDate: '2026-08-01',
    });

    expect(snapshot.providers[0]).toMatchObject({
      freshness: 'never_synced',
      lastSyncedAt: null,
      metrics: null,
      provider: 'meta_ads',
    });
    expect(snapshot.spendByCurrency).toEqual([]);
  });
});
