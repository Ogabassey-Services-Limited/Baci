import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const usableToken = vi.fn();
const accounts = vi.fn();
const csrf = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/snapchat/access-token', () => ({
  getSnapchatAdsUsableAccessToken: (...args: unknown[]) => usableToken(...args),
  SnapchatAdsTokenRefreshError: class SnapchatAdsTokenRefreshError extends Error {},
}));
vi.mock('@/lib/ads/snapchat/config', () => ({
  getSnapchatAdsConfig: () => ({ tokenEncryptionKey: 'key' }),
  SNAPCHAT_ADS_CONFIG_MISSING: 'Snapchat Ads integration is not configured',
  SnapchatAdsConfigError: class SnapchatAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/snapchat/provider', () => ({
  listSnapchatAdsAccounts: (...args: unknown[]) => accounts(...args),
  SnapchatAdsProviderError: class SnapchatAdsProviderError extends Error {},
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));

import { GET, PATCH } from './route';

describe('Snapchat Ads accounts route', () => {
  it('denies unauthenticated discovery and selection', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts'
          )
        )
      ).status
    ).toBe(401);
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts',
            { body: '{}', method: 'PATCH' }
          )
        )
      ).status
    ).toBe(401);
  });

  it('refreshes an expired connection token before discovery and revalidated selection', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'get_merchant_ads_connection_secret')
        return Promise.resolve({
          data: [
            {
              access_token_ciphertext: 'old',
              provider_customer_id: null,
              refresh_token_ciphertext: 'refresh',
              status: 'active',
              token_expires_at: '2026-08-20T00:00:00Z',
            },
          ],
          error: null,
        });
      return Promise.resolve({ data: true, error: null });
    });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    usableToken.mockResolvedValue('refreshed');
    accounts.mockResolvedValue([
      {
        accountId: 'ad-1',
        currencyCode: 'USD',
        label: 'Account',
        organizationId: 'org',
        timezoneName: 'UTC',
      },
    ]);
    csrf.mockResolvedValue({ valid: true });
    await expect(
      GET(
        new NextRequest(
          'https://usebaci.com/api/integrations/ads/snapchat/accounts'
        )
      )
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      PATCH(
        new NextRequest(
          'https://usebaci.com/api/integrations/ads/snapchat/accounts',
          { body: JSON.stringify({ accountId: 'ad-1' }), method: 'PATCH' }
        )
      )
    ).resolves.toMatchObject({ status: 200 });
    expect(usableToken).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith(
      'set_merchant_ads_account',
      expect.objectContaining({ p_provider_customer_id: 'ad-1' })
    );
  });

  it('drives permission, CSRF, Zod, and inaccessible-account branches', async () => {
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(false);
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts'
          )
        )
      ).status
    ).toBe(403);
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: false });
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts',
            { body: '{}', method: 'PATCH' }
          )
        )
      ).status
    ).toBe(403);
    csrf.mockResolvedValue({ valid: true });
    expect(
      (
        await PATCH(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/accounts',
            { body: '{}', method: 'PATCH' }
          )
        )
      ).status
    ).toBe(400);
  });
});
