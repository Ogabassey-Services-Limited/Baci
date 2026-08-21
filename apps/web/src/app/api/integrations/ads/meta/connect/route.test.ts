import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/crypto', () => ({
  generateAdsRandomValue: () => 'a'.repeat(24),
}));
vi.mock('@/lib/ads/meta/config', () => ({
  getMetaAdsConfig: () => ({
    oauthStateSecret: 'state-secret',
    redirectUri: 'https://usebaci.com/api/integrations/ads/meta/callback',
  }),
  META_ADS_CONFIG_MISSING: 'Meta Ads integration is not configured',
  MetaAdsConfigError: class MetaAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/meta/oauth', () => ({
  buildMetaAdsAuthorizationUrl: () => 'https://facebook.com/oauth',
}));
vi.mock('@/lib/ads/state', () => ({
  createAdsOAuthState: () => 'signed-state',
}));

import { GET } from './route';

describe('Meta Ads connect route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('rejects unauthenticated requests before OAuth state generation', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/meta/connect'
          )
        )
      ).status
    ).toBe(401);
  });

  it('reserves its signed state nonce before redirecting to Meta', async () => {
    const response = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/meta/connect')
    );

    expect(response.status).toBe(307);
    expect(rpc).toHaveBeenCalledWith(
      'reserve_merchant_ads_oauth_state_nonce',
      expect.objectContaining({
        p_nonce: 'a'.repeat(24),
        p_provider: 'meta_ads',
      })
    );
  });

  it('does not redirect when nonce reservation is rejected', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/meta/connect')
    );

    expect(response.status).toBe(503);
  });
});
