import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const compare = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const verifyState = vi.fn();
const rpc = vi.fn();
const resolveMerchant = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/merchant-context', () => ({
  resolveAdsMerchantAccess: (...args: unknown[]) => resolveMerchant(...args),
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
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMerchant.mockResolvedValue({
      access: { merchantId: 'merchant' },
      response: null,
    });
  });

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
    verifyState.mockReturnValue({
      merchantId: 'merchant',
      nonce: 'n'.repeat(24),
    });
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

  it('consumes OAuth state only for its signed selected merchant', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    compare.mockReturnValue(true);
    permission.mockReturnValue(true);
    verifyState.mockReturnValue({
      merchantId: '550e8400-e29b-41d4-a716-446655440000',
      nonce: 'n'.repeat(24),
    });
    resolveMerchant.mockResolvedValue({
      access: { merchantId: '550e8400-e29b-41d4-a716-446655440000' },
      response: null,
    });
    rpc.mockResolvedValue({ data: false, error: null });

    await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/meta/callback?state=state&code=code',
        { headers: { cookie: 'baci_meta_ads_oauth_state=state' } }
      )
    );

    expect(resolveMerchant).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: '550e8400-e29b-41d4-a716-446655440000',
      })
    );
    expect(rpc).toHaveBeenCalledWith(
      'consume_merchant_ads_oauth_state_nonce',
      expect.objectContaining({
        p_merchant_id: '550e8400-e29b-41d4-a716-446655440000',
      })
    );
  });
});
