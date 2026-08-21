import { describe, expect, it, vi } from 'vitest';
import {
  fetchSnapchatAdsDailyReport,
  listSnapchatAdsAccounts,
} from './provider';

describe('Snapchat Ads provider', () => {
  it('discovers only active nested ad accounts with their organization and timezone', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          organizations: [
            {
              ad_accounts: [
                {
                  currency: 'USD',
                  id: 'ad-1',
                  name: 'Active account',
                  status: 'ACTIVE',
                  timezone: 'America/New_York',
                },
                {
                  currency: 'USD',
                  id: 'ad-2',
                  name: 'Disabled',
                  status: 'PAUSED',
                  timezone: 'UTC',
                },
              ],
              id: 'org-1',
            },
          ],
        })
      )
    );
    await expect(
      listSnapchatAdsAccounts({ accessToken: 'token' }, fetchImpl)
    ).resolves.toEqual([
      {
        accountId: 'ad-1',
        currencyCode: 'USD',
        label: 'Active account',
        organizationId: 'org-1',
        timezoneName: 'America/New_York',
      },
    ]);
    expect(
      new URL(fetchImpl.mock.calls[0]?.[0].toString()).searchParams.get(
        'with_ad_accounts'
      )
    ).toBe('true');
  });

  it('uses account-local DATE across DST and keeps provider micro-currency exact', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          timeseries_stats: [
            {
              end_time: '2026-03-09T04:00:00Z',
              start_time: '2026-03-08T05:00:00Z',
              stats: {
                conversion_purchases: '1.5',
                impressions: '9007199254740993',
                spend: '9007199254740993',
                swipes: '7',
              },
            },
          ],
        })
      )
    );
    await expect(
      fetchSnapchatAdsDailyReport(
        {
          accessToken: 'token',
          accountId: 'ad-1',
          currencyCode: 'USD',
          endDate: '2026-03-08',
          startDate: '2026-03-08',
          timezoneName: 'America/New_York',
        },
        fetchImpl
      )
    ).resolves.toEqual([
      expect.objectContaining({
        spendAmountDecimal: '9007199254.740993',
        spendDate: '2026-03-08',
        spendMicros: '9007199254740993',
      }),
    ]);
    const url = new URL(fetchImpl.mock.calls[0]?.[0].toString());
    expect(url.searchParams.get('granularity')).toBe('DAY');
    expect(url.searchParams.get('start_time')).toBe('2026-03-08T05:00:00.000Z');
    expect(url.searchParams.get('end_time')).toBe('2026-03-09T04:00:00.000Z');
  });
});
