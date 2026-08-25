import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveToken = vi.fn();
const config = vi.fn();
const accounts = vi.fn();
const reports = vi.fn();

vi.mock('./access-token', () => ({
  resolveTikTokAdsAccessToken: (...args: unknown[]) => resolveToken(...args),
}));
vi.mock('./config', () => ({
  getTikTokAdsConfig: (...args: unknown[]) => config(...args),
}));
vi.mock('./provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./provider')>()),
  fetchTikTokAdsDailyReport: (...args: unknown[]) => reports(...args),
  listTikTokAdsAccounts: (...args: unknown[]) => accounts(...args),
}));

import { syncTikTokAdsSpendForMerchant, tiktokAdsDateChunks } from './sync';

describe('TikTok Ads sync', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    config.mockReturnValue({ appId: 'app', appSecret: 'secret' });
    resolveToken.mockReturnValue('token');
    accounts.mockResolvedValue([
      {
        accountId: 'opaque-001',
        currencyCode: 'NGN',
        label: 'Account',
        timezoneName: 'Africa/Lagos',
      },
    ]);
    reports.mockResolvedValue([
      {
        accountId: 'opaque-001',
        clicks: '2',
        conversions: '1',
        currencyCode: 'NGN',
        impressions: '10',
        reach: null,
        spendAmountDecimal: '1.000000001',
        spendDate: '2026-08-20',
        timezoneName: 'Africa/Lagos',
      },
    ]);
    rpc.mockImplementation((name: string) => {
      if (name === 'get_merchant_ads_connection_secret')
        return Promise.resolve({
          data: [
            {
              access_token_ciphertext: 'cipher',
              provider_customer_id: 'opaque-001',
              status: 'active',
            },
          ],
          error: null,
        });
      return Promise.resolve({
        data: name === 'replace_merchant_ads_spend_daily_window' ? 1 : true,
        error: null,
      });
    });
  });

  it('splits account-local reporting requests into inclusive 30-day chunks', () =>
    expect(tiktokAdsDateChunks('2026-08-01', '2026-08-31')).toEqual([
      { startDate: '2026-08-01', endDate: '2026-08-30' },
      { startDate: '2026-08-31', endDate: '2026-08-31' },
    ]));

  it('rediscovers the opaque account, writes exact decimals, and runs every requested chunk', async () => {
    await expect(
      syncTikTokAdsSpendForMerchant({
        merchantId: 'merchant',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        supabase: { rpc } as never,
      })
    ).resolves.toEqual({ accountId: 'opaque-001', rowsWritten: 1 });
    expect(reports).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith(
      'replace_merchant_ads_spend_daily_window',
      expect.objectContaining({
        p_rows: expect.arrayContaining([
          expect.objectContaining({ spend_amount_decimal: '1.000000001' }),
        ]),
      })
    );
    expect(rpc).toHaveBeenCalledWith(
      'mark_merchant_ads_connection_synced_if_current',
      {
        p_merchant_id: 'merchant',
        p_provider: 'tiktok_ads',
        p_provider_customer_id: 'opaque-001',
      }
    );
  });

  it('replaces the TikTok window even when the provider returns no activity', async () => {
    reports.mockResolvedValueOnce([]);
    rpc.mockResolvedValueOnce({
      data: [
        {
          access_token_ciphertext: 'cipher',
          provider_customer_id: 'opaque-001',
          status: 'active',
        },
      ],
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: 0, error: null });

    await expect(
      syncTikTokAdsSpendForMerchant({
        merchantId: 'merchant',
        startDate: '2026-08-20',
        endDate: '2026-08-20',
        supabase: { rpc } as never,
      })
    ).resolves.toEqual({ accountId: 'opaque-001', rowsWritten: 0 });

    expect(rpc).toHaveBeenCalledWith(
      'replace_merchant_ads_spend_daily_window',
      expect.objectContaining({
        p_end_date: '2026-08-20',
        p_provider: 'tiktok_ads',
        p_provider_customer_id: 'opaque-001',
        p_rows: [],
        p_start_date: '2026-08-20',
      })
    );
  });

  it('persists a revoked structured-token failure as reauthentication required', async () => {
    reports.mockRejectedValueOnce(
      Object.assign(new Error('revoked'), { code: 'TIKTOK_ADS_ACCESS_REVOKED' })
    );
    await expect(
      syncTikTokAdsSpendForMerchant({
        merchantId: 'merchant',
        startDate: '2026-08-20',
        endDate: '2026-08-20',
        supabase: { rpc } as never,
      })
    ).rejects.toMatchObject({ code: 'TIKTOK_ADS_ACCESS_REVOKED' });
    expect(rpc).toHaveBeenCalledWith(
      'mark_merchant_ads_connection_reauth_if_current',
      expect.objectContaining({
        p_reason: 'TIKTOK_ADS_ACCESS_REVOKED',
        p_refresh_token_ciphertext: null,
      })
    );
  });

  it('does not write an earlier chunk when a later provider request fails', async () => {
    reports
      .mockResolvedValueOnce([
        {
          accountId: 'opaque-001',
          clicks: '2',
          conversions: '1',
          currencyCode: 'NGN',
          impressions: '10',
          reach: null,
          spendAmountDecimal: '1.00',
          spendDate: '2026-08-20',
          timezoneName: 'Africa/Lagos',
        },
      ])
      .mockRejectedValueOnce(new Error('second chunk failed'));

    await expect(
      syncTikTokAdsSpendForMerchant({
        merchantId: 'merchant',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        supabase: { rpc } as never,
      })
    ).rejects.toThrow('second chunk failed');
    expect(rpc).not.toHaveBeenCalledWith(
      'replace_merchant_ads_spend_daily_window',
      expect.anything()
    );
  });
});
