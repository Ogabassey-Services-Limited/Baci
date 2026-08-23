import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOAuthConfig = vi.fn();
const mockGetReportingConfig = vi.fn();
const mockResolveToken = vi.fn();
const mockFetchSpend = vi.fn();
const mockRpc = vi.fn();
const supabase = { rpc: mockRpc } as never;

vi.mock('@/lib/google-ads/config', () => ({
  getGoogleAdsOAuthConfig: (...args: unknown[]) => mockGetOAuthConfig(...args),
  getGoogleAdsReportingConfig: (...args: unknown[]) =>
    mockGetReportingConfig(...args),
}));
vi.mock('@/lib/google-ads/access-token', () => ({
  resolveGoogleAdsAccessToken: (...args: unknown[]) =>
    mockResolveToken(...args),
}));
vi.mock('@/lib/google-ads/provider', () => ({
  fetchGoogleAdsDailySpend: (...args: unknown[]) => mockFetchSpend(...args),
}));

import { syncGoogleAdsSpendForMerchant } from './sync';

describe('syncGoogleAdsSpendForMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOAuthConfig.mockReturnValue({
      clientId: 'client',
      clientSecret: 'secret',
      oauthStateSecret: 'state',
      redirectUri: 'https://usebaci.com/api/integrations/ads/google/callback',
      tokenEncryptionKey: 'key',
    });
    mockGetReportingConfig.mockReturnValue({
      developerToken: 'developer-token',
    });
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_google_ads_connection_secret') {
        return Promise.resolve({
          data: [
            {
              access_token_ciphertext: 'encrypted-access',
              id: 'connection-1',
              provider_customer_id: '1234567890',
              refresh_token_ciphertext: 'encrypted-refresh',
              status: 'active',
              token_expires_at: '2026-08-22T00:00:00.000Z',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: true, error: null });
    });
    mockResolveToken.mockResolvedValue({
      accessToken: 'access-token',
      encryptedAccessToken: null,
      expiresAt: '2026-08-22T00:00:00.000Z',
    });
    mockFetchSpend.mockResolvedValue([
      {
        clicks: 4,
        conversions: 1.25,
        currencyCode: 'NGN',
        customerId: '1234567890',
        date: '2026-08-20',
        impressions: 100,
        spendMicros: 2500000,
      },
    ]);
  });

  it('writes normalized provider rows through the guarded RPCs', async () => {
    const result = await syncGoogleAdsSpendForMerchant({
      endDate: '2026-08-21',
      merchantId: 'merchant-1',
      startDate: '2026-08-20',
      supabase,
    });

    expect(result).toEqual({ customerId: '1234567890', rowsWritten: 1 });
    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_google_ads_spend_daily',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_rows: [
          expect.objectContaining({
            clicks: 4,
            currency_code: 'NGN',
            provider_customer_id: '1234567890',
            spend_micros: 2500000,
          }),
        ],
      })
    );
    expect(mockRpc).toHaveBeenCalledWith('mark_google_ads_connection_synced', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('rejects a sync date range beyond the bounded window before any provider read', async () => {
    await expect(
      syncGoogleAdsSpendForMerchant({
        endDate: '2026-08-21',
        merchantId: 'merchant-1',
        startDate: '2026-01-01',
        supabase,
      })
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFetchSpend).not.toHaveBeenCalled();
  });

  it('marks the connection for reauthorization when Google rejects its refresh token', async () => {
    const refreshFailure = Object.assign(
      new Error('GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED'),
      { code: 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED', status: 400 }
    );
    mockResolveToken.mockRejectedValueOnce(refreshFailure);

    await expect(
      syncGoogleAdsSpendForMerchant({
        endDate: '2026-08-21',
        merchantId: 'merchant-1',
        startDate: '2026-08-20',
        supabase,
      })
    ).rejects.toMatchObject({ code: 'ACCESS_TOKEN_REFRESH_FAILED' });
    expect(mockRpc).toHaveBeenCalledWith(
      'mark_google_ads_connection_reauth_if_current',
      {
        p_access_token_ciphertext: 'encrypted-access',
        p_merchant_id: 'merchant-1',
        p_reason: 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED',
        p_refresh_token_ciphertext: 'encrypted-refresh',
      }
    );
    expect(mockFetchSpend).not.toHaveBeenCalled();
  });
});
