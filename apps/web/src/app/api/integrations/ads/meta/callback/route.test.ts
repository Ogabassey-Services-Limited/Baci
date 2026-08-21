import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const compare = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const verifyState = vi.fn();
const rpc = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/crypto', () => ({
  encryptAdsToken: vi.fn(),
  timingSafeStringEqual: (...args: unknown[]) => compare(...args),
}));
vi.mock('@/lib/ads/meta/config', () => ({
  getMetaAdsConfig: () => ({
    appId: 'app',
    appSecret: 'secret',
    oauthStateSecret: 'a'.repeat(32),
    redirectUri: 'https://usebaci.com/api/integrations/ads/meta/callback',
    tokenEncryptionKey: Buffer.alloc(32).toString('base64url'),
  }),
  MetaAdsConfigError: class MetaAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/state', () => ({
  verifyAdsOAuthState: (...args: unknown[]) => verifyState(...args),
}));

import { GET } from './route';

describe('Meta Ads callback route', () => {
  it('fails state mismatch without exchanging a code or reflecting the callback host', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    compare.mockReturnValue(false);
    const response = await GET(
      new NextRequest(
        'https://evil.example/api/integrations/ads/meta/callback?state=state&code=code',
        { headers: { cookie: 'baci_meta_ads_oauth_state=stored' } }
      )
    );
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/dashboard/analytics?meta_ads=error&reason=invalid_state'
    );
  });

  it('fails a consumed state before exchanging a replayed authorization code', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    compare.mockReturnValue(true);
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    verifyState.mockReturnValue({ nonce: 'n'.repeat(24) });
    rpc.mockResolvedValue({ data: false, error: null });

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/meta/callback?state=state&code=code',
        { headers: { cookie: 'baci_meta_ads_oauth_state=state' } }
      )
    );

    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/dashboard/analytics?meta_ads=error&reason=invalid_state'
    );
    expect(rpc).toHaveBeenCalledWith(
      'consume_merchant_ads_oauth_state_nonce',
      expect.objectContaining({ p_provider: 'meta_ads' })
    );
  });
});
