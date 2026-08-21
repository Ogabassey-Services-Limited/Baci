import { describe, expect, it } from 'vitest';
import { buildGoogleAdsAnalyticsSnapshot } from './analytics-snapshot';

describe('buildGoogleAdsAnalyticsSnapshot', () => {
  it('omits spend values when no rows exist', () => {
    expect(
      buildGoogleAdsAnalyticsSnapshot(
        {
          last_synced_at: null,
          provider_customer_id: null,
          status: 'active',
        },
        []
      )
    ).toEqual({
      connected: true,
      customerId: null,
      lastSyncedAt: null,
      needsAccountSelection: true,
    });
  });

  it('aggregates daily rows without losing micros precision in the API field', () => {
    const result = buildGoogleAdsAnalyticsSnapshot(
      {
        last_synced_at: '2026-08-21T10:00:00.000Z',
        provider_customer_id: '1234567890',
        status: 'active',
      },
      [
        {
          clicks: 1,
          conversions: '0.5',
          currency_code: 'NGN',
          fetched_at: '2026-08-21T10:00:00.000Z',
          impressions: 10,
          provider_customer_id: '1234567890',
          spend_date: '2026-08-20',
          spend_micros: '1250000',
        },
      ]
    );

    expect(result).toMatchObject({
      currencyCode: 'NGN',
      needsAccountSelection: false,
      spend: 1.25,
      spendMicros: '1250000',
    });
    expect(result?.daily?.[0]).toMatchObject({
      date: '2026-08-20',
      spend: 1.25,
    });
  });
});
