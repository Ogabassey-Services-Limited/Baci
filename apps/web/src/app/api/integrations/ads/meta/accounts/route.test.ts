import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const csrf = vi.fn();
const listAccounts = vi.fn();
const resolveToken = vi.fn();
const rpc = vi.fn();
const getConfig = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => csrf(...args),
}));
vi.mock('@/lib/ads/meta/config', () => ({
  getMetaAdsConfig: (...args: unknown[]) => getConfig(...args),
  META_ADS_CONFIG_MISSING: 'Meta Ads integration is not configured',
  MetaAdsConfigError: class MetaAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/meta/access-token', () => ({
  resolveMetaAdsAccessToken: (...args: unknown[]) => resolveToken(...args),
}));
vi.mock('@/lib/ads/meta/provider', () => ({
  listMetaAdsAccounts: (...args: unknown[]) => listAccounts(...args),
  MetaAdsProviderError: class MetaAdsProviderError extends Error {},
}));

import { GET, PATCH } from './route';

describe('Meta Ads accounts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    csrf.mockResolvedValue({ valid: true });
    getConfig.mockReturnValue({});
    resolveToken.mockReturnValue('access');
    listAccounts.mockResolvedValue([
      {
        accountId: 'act_12',
        currencyCode: 'NGN',
        label: 'Verified account',
        timezoneName: 'Africa/Lagos',
        timezoneOffsetHours: '1',
      },
    ]);
    rpc.mockImplementation((name: string) =>
      name === 'get_merchant_ads_connection_secret'
        ? Promise.resolve({
            data: [
              {
                access_token_ciphertext: 'cipher',
                provider_customer_id: null,
                status: 'active',
                token_expires_at: '2026-10-01T00:00:00Z',
              },
            ],
            error: null,
          })
        : Promise.resolve({ data: true, error: null })
    );
  });

  it('distinguishes missing configuration from provider authorization errors', async () => {
    getConfig.mockImplementationOnce(() => {
      const error = new Error('missing');
      error.name = 'MetaAdsConfigError';
      throw error;
    });
    const configuration = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/meta/accounts')
    );
    expect(configuration.status).toBe(503);
    expect((await configuration.json()).error).toBe(
      'Meta Ads integration is not configured'
    );
    listAccounts.mockRejectedValueOnce(
      Object.assign(new Error('META_ADS_ACCESS_REVOKED'), {
        code: 'META_ADS_ACCESS_REVOKED',
      })
    );
    const revoked = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/meta/accounts')
    );
    expect(revoked.status).toBe(502);
    expect((await revoked.json()).error).toBe('META_ADS_ACCESS_REVOKED');
  });
  it('does not discover accounts without authentication', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/meta/accounts'
          )
        )
      ).status
    ).toBe(401);
  });

  it('selects only a freshly discovered canonical act_ account', async () => {
    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/meta/accounts',
        {
          body: JSON.stringify({ accountId: 'act_12' }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'set_merchant_ads_account',
      expect.objectContaining({ p_provider_customer_id: 'act_12' })
    );
    listAccounts.mockResolvedValueOnce([]);
    const rejected = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/meta/accounts',
        {
          body: JSON.stringify({ accountId: 'act_99' }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );
    expect(rejected.status).toBe(400);
  });
});
