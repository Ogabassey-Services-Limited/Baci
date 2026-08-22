import { describe, expect, it } from 'vitest';
import { buildGoogleAdsAnalyticsSnapshot } from './analytics-snapshot';

describe('buildGoogleAdsAnalyticsSnapshot', () => {
  it('omits historical spend when the connected account has no selection', () => {
    expect(
      buildGoogleAdsAnalyticsSnapshot(
        {
          last_synced_at: null,
          provider_customer_id: null,
          status: 'active',
        },
        [
          {
            clicks: 50,
            conversions: '5',
            currency_code: 'USD',
            fetched_at: '2026-08-20T10:00:00.000Z',
            impressions: 500,
            provider_customer_id: 'previous-account',
            spend_date: '2026-08-20',
            spend_micros: '999000000',
          },
        ]
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
          clicks: 99,
          conversions: '10',
          currency_code: 'USD',
          fetched_at: '2026-08-20T09:00:00.000Z',
          impressions: 999,
          provider_customer_id: 'previous-account',
          spend_date: '2026-08-19',
          spend_micros: '500000000',
        },
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
    expect(result?.daily).toHaveLength(1);
  });

  it('does not expose cached metrics while the selected account needs reconnecting', () => {
    const result = buildGoogleAdsAnalyticsSnapshot(
      {
        last_synced_at: '2026-08-21T10:00:00.000Z',
        provider_customer_id: '1234567890',
        status: 'error',
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

    expect(result).toEqual({
      connected: false,
      customerId: '1234567890',
      lastSyncedAt: '2026-08-21T10:00:00.000Z',
      needsAccountSelection: false,
    });
  });
});
