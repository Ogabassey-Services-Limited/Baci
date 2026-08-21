import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const compare = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
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
});
