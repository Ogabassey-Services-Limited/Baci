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
      connectionStatus: 'connected',
      customerId: null,
      dataStatus: 'ready',
      isStale: false,
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
      connectionStatus: 'connected',
      currencyCode: 'NGN',
      dataStatus: 'ready',
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
      connectionStatus: 'error',
      customerId: '1234567890',
      dataStatus: 'ready',
      error: 'This connection needs to be reauthorized.',
      isStale: false,
      lastSyncedAt: '2026-08-21T10:00:00.000Z',
      needsAccountSelection: false,
    });
  });

  it('keeps a read failure visible instead of presenting a disconnected account', () => {
    expect(
      buildGoogleAdsAnalyticsSnapshot(null, [], {
        connectionReadFailed: true,
      })
    ).toEqual({
      connected: false,
      connectionStatus: 'error',
      customerId: null,
      dataStatus: 'error',
      error: 'Google Ads reporting is temporarily unavailable.',
      isStale: false,
      lastSyncedAt: null,
      needsAccountSelection: false,
    });
  });

  it('keeps the selected account context when the spend read fails', () => {
    expect(
      buildGoogleAdsAnalyticsSnapshot(
        {
          last_synced_at: '2026-08-20T09:00:00.000Z',
          provider_customer_id: '1234567890',
          status: 'active',
        },
        [],
        { spendReadFailed: true }
      )
    ).toMatchObject({
      connected: true,
      connectionStatus: 'connected',
      customerId: '1234567890',
      dataStatus: 'error',
      error: 'Google Ads reporting is temporarily unavailable.',
      needsAccountSelection: false,
    });
  });

  it('marks old selected-account reporting data as stale', () => {
    expect(
      buildGoogleAdsAnalyticsSnapshot(
        {
          last_synced_at: '2026-08-19T09:00:00.000Z',
          provider_customer_id: '1234567890',
          status: 'active',
        },
        [],
        { now: new Date('2026-08-22T10:00:00.000Z') }
      )
    ).toMatchObject({
      isStale: true,
      lastSyncedAt: '2026-08-19T09:00:00.000Z',
    });
  });

  it('does not mark an incomplete chunk fresh from its row timestamp', () => {
    const result = buildGoogleAdsAnalyticsSnapshot(
      {
        last_synced_at: '2026-08-19T09:00:00.000Z',
        provider_customer_id: '1234567890',
        status: 'active',
      },
      [
        {
          clicks: 1,
          conversions: 0,
          currency_code: 'NGN',
          fetched_at: '2026-08-22T09:00:00.000Z',
          impressions: 1,
          provider_customer_id: '1234567890',
          spend_date: '2026-08-22',
          spend_micros: 1,
        },
      ],
      { now: new Date('2026-08-22T10:00:00.000Z') }
    );

    expect(result?.lastSyncedAt).toBe('2026-08-19T09:00:00.000Z');
    expect(result?.isStale).toBe(true);
  });
});
