import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/crypto', () => ({ generateAdsRandomValue: () => 'nonce' }));
vi.mock('@/lib/ads/state', () => ({
  createAdsOAuthState: () => 'signed-state',
}));
vi.mock('@/lib/ads/tiktok/config', () => ({
  getTikTokAdsConfig: () => ({
    authorizationUrl: 'https://business-api.tiktok.com/portal/authorize',
    oauthStateSecret: 'state-secret',
    redirectUri: 'https://usebaci.com/api/integrations/ads/tiktok/callback',
  }),
  TIKTOK_ADS_CONFIG_MISSING: 'TikTok Ads integration is not configured',
  TikTokAdsConfigError: class TikTokAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/tiktok/oauth', () => ({
  buildTikTokAdsAuthorizationUrl: () =>
    'https://business-api.tiktok.com/portal/authorize?state=signed-state',
}));

import { GET } from './route';

describe('TikTok Ads connect route', () => {
  it('denies OAuth before state generation when unauthenticated', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/connect'
          )
        )
      ).status
    ).toBe(401);
  });

  it('rejects an authenticated user without integrations manage permission', async () => {
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
            'https://usebaci.com/api/integrations/ads/tiktok/connect'
          )
        )
      ).status
    ).toBe(403);
  });

  it('redirects an authorized merchant with an HttpOnly signed-state cookie', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/tiktok/connect')
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain(
      'business-api.tiktok.com'
    );
    expect(response.headers.get('set-cookie')).toContain(
      'baci_tiktok_ads_oauth_state=signed-state'
    );
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
});
