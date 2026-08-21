import { describe, expect, it, vi } from 'vitest';
import {
  fetchTikTokAdsDailyReport,
  listTikTokAdsAccounts,
  parseTikTokAdsAsyncTaskStatus,
} from './provider';

describe('TikTok Ads provider', () => {
  it('preserves exact decimals, advertiser timezone, and provider-labelled conversions', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            list: [
              {
                advertiser_id: 'opaque-001',
                dimensions: {
                  stat_time_day: '2026-08-20 00:00:00',
                  timezone: 'Africa/Lagos',
                },
                metrics: {
                  spend: '9007199254740993.123456789',
                  impressions: '10',
                  clicks: '2',
                  conversion: '1.5',
                  currency: 'NGN',
                  reach: '8',
                },
              },
            ],
            page_info: { page: 1, total_page: 1 },
          },
        })
      )
    );
    await expect(
      fetchTikTokAdsDailyReport(
        {
          accessToken: 'token',
          accountId: 'opaque-001',
          startDate: '2026-08-20',
          endDate: '2026-08-20',
        },
        fetchImpl
      )
    ).resolves.toEqual([
      expect.objectContaining({
        spendAmountDecimal: '9007199254740993.123456789',
        timezoneName: 'Africa/Lagos',
      }),
    ]);
  });
  it('retries bounded TikTok throttles without retaining error bodies', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 40100, message: 'secret body' }), {
          status: 400,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { list: [] } }))
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      listTikTokAdsAccounts(
        { accessToken: 'token', appId: 'app', appSecret: 'secret' },
        fetchImpl,
        sleep
      )
    ).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledOnce();
  });
  it('keeps async task states bounded and explicit', () => {
    expect(
      parseTikTokAdsAsyncTaskStatus({ data: { task_status: 'PROCESSING' } })
    ).toBe('PROCESSING');
    expect(
      parseTikTokAdsAsyncTaskStatus({ data: { task_status: 'unknown' } })
    ).toBeNull();
  });
});
