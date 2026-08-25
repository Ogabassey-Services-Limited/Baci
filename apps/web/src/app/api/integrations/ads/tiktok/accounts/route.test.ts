import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const invalidateAnalytics = vi.fn();
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) =>
    invalidateAnalytics(...args),
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
const csrf = vi.fn();
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));
vi.mock('@/lib/ads/tiktok/config', () => ({
  getTikTokAdsConfig: () => ({
    appId: 'app',
    appSecret: 'secret',
    tokenEncryptionKey: 'key',
  }),
  TIKTOK_ADS_CONFIG_MISSING: 'TikTok Ads integration is not configured',
  TikTokAdsConfigError: class TikTokAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/tiktok/access-token', () => ({
  resolveTikTokAdsAccessToken: () => 'token',
}));
const listAccounts = vi.fn();
vi.mock('@/lib/ads/tiktok/provider', () => ({
  listTikTokAdsAccounts: (...args: unknown[]) => listAccounts(...args),
  TikTokAdsProviderError: class TikTokAdsProviderError extends Error {},
}));
vi.mock('@/lib/ads/tiktok/sync', () => ({
  markTikTokAdsReauthRequired: vi.fn(),
  TikTokAdsReauthPersistenceError: class TikTokAdsReauthPersistenceError extends Error {},
}));

import { GET, PATCH } from './route';

describe('TikTok Ads accounts route', () => {
  it('denies unauthorized advertiser discovery before accepting a browser account id', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts'
          )
        )
      ).status
    ).toBe(401);
  });

  it('enforces integrations permission for an authenticated merchant', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(false);
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts'
          )
        )
      ).status
    ).toBe(403);
  });

  it('rejects browser-supplied opaque IDs before provider rediscovery when CSRF is valid', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts',
            {
              body: JSON.stringify({ accountId: 'not an id' }),
              method: 'PATCH',
            }
          )
        )
      ).status
    ).toBe(400);
  });

  it('rediscovers an authorized opaque advertiser and persists the selected account', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'get_merchant_ads_connection_secret')
        return Promise.resolve({
          data: [
            {
              access_token_ciphertext: 'cipher',
              provider_customer_id: null,
              status: 'active',
            },
          ],
          error: null,
        });
      return Promise.resolve({ data: true, error: null });
    });
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    listAccounts.mockResolvedValue([
      {
        accountId: 'opaque-001',
        currencyCode: 'NGN',
        label: 'Account',
        timezoneName: 'Africa/Lagos',
      },
    ]);
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts',
            {
              body: JSON.stringify({ accountId: 'opaque-001' }),
              method: 'PATCH',
            }
          )
        )
      ).status
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'set_merchant_ads_account',
      expect.objectContaining({
        p_expected_access_token_ciphertext: 'cipher',
        p_provider_customer_id: 'opaque-001',
      })
    );
    expect(invalidateAnalytics).toHaveBeenCalledWith('merchant');
  });

  it('does not persist a well-formed advertiser ID absent from fresh discovery', async () => {
    const rpc = vi.fn((name: string) =>
      Promise.resolve({
        data:
          name === 'get_merchant_ads_connection_secret'
            ? [
                {
                  access_token_ciphertext: 'cipher',
                  provider_customer_id: null,
                  status: 'active',
                },
              ]
            : true,
        error: null,
      })
    );
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    listAccounts.mockResolvedValue([]);
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/accounts',
            {
              body: JSON.stringify({ accountId: 'opaque-unknown' }),
              method: 'PATCH',
            }
          )
        )
      ).status
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalledWith(
      'set_merchant_ads_account',
      expect.anything()
    );
  });

  it('rejects malformed selection input before merchant lookup', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc: vi.fn() },
      user: { id: 'user' },
    });
    csrf.mockResolvedValue({ valid: true });
    access.mockClear();
    listAccounts.mockClear();

    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/tiktok/accounts',
        { body: '{', method: 'PATCH' }
      )
    );

    expect(response.status).toBe(400);
    expect(access).not.toHaveBeenCalled();
    expect(listAccounts).not.toHaveBeenCalled();
  });
});
