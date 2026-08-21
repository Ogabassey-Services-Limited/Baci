import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const compare = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
const verifyState = vi.fn();
vi.mock('@/lib/ads/state', () => ({
  verifyAdsOAuthState: (...args: unknown[]) => verifyState(...args),
}));
const exchange = vi.fn();
vi.mock('@/lib/ads/tiktok/oauth', () => ({
  exchangeTikTokAdsAuthorizationCode: (...args: unknown[]) => exchange(...args),
  TikTokAdsOAuthError: class TikTokAdsOAuthError extends Error {},
}));
vi.mock('@/lib/ads/crypto', () => ({
  encryptAdsToken: vi.fn(),
  timingSafeStringEqual: (...args: unknown[]) => compare(...args),
}));
vi.mock('@/lib/ads/tiktok/config', () => ({
  getTikTokAdsConfig: () => ({
    appId: 'app',
    appSecret: 'secret',
    authorizationUrl: 'https://business-api.tiktok.com/portal/authorize',
    oauthStateSecret: 'a'.repeat(32),
    redirectUri: 'https://usebaci.com/api/integrations/ads/tiktok/callback',
    tokenEncryptionKey: 'key',
  }),
  TikTokAdsConfigError: class TikTokAdsConfigError extends Error {},
}));

import { GET } from './route';

describe('TikTok Ads callback route', () => {
  it('rejects state replay/mismatch and never reflects an attacker callback host', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    compare.mockReturnValue(false);
    const response = await GET(
      new NextRequest(
        'https://evil.example/api/integrations/ads/tiktok/callback?state=state&code=code',
        { headers: { cookie: 'baci_tiktok_ads_oauth_state=stored' } }
      )
    );
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/dashboard/analytics?tiktok_ads=error&reason=invalid_state'
    );
  });

  it('rejects a state-validated callback that omitted the required reporting scopes', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    compare.mockReturnValue(true);
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    verifyState.mockReturnValue({ merchantId: 'merchant' });
    exchange.mockResolvedValue({
      accessToken: 'token',
      advertiserIds: ['opaque-001'],
      scopes: ['100'],
    });
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/tiktok/callback?state=state&code=code',
        { headers: { cookie: 'baci_tiktok_ads_oauth_state=state' } }
      )
    );
    expect(response.headers.get('location')).toContain(
      'reason=required_scopes_missing'
    );
  });
});
