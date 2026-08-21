import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { createAdsOAuthState } from '@/lib/ads/state';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/snapchat/config', () => ({
  getSnapchatAdsConfig: () => ({
    oauthStateSecret: 'x'.repeat(32),
    redirectUri: 'https://usebaci.com/api/integrations/ads/snapchat/callback',
    tokenEncryptionKey: 'key',
  }),
  SnapchatAdsConfigError: class SnapchatAdsConfigError extends Error {},
}));

import { GET } from './route';

describe('Snapchat Ads callback route', () => {
  it('rejects unauthenticated callbacks before exchanging a replayed code', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/callback?code=replay'
          )
        )
      ).status
    ).toBe(401);
  });

  it('rejects a signed-state callback when the HttpOnly cookie does not match', async () => {
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc: vi.fn() },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/callback?code=code&state=different',
        { headers: { cookie: 'baci_snapchat_ads_oauth_state=other' } }
      )
    );
    expect(response.headers.get('location')).toContain('reason=invalid_state');
  });

  it('fails a consumed server nonce before it can exchange a replayed code', async () => {
    const state = createAdsOAuthState(
      {
        merchantId: 'merchant',
        nonce: 'nonce-value-that-is-long-enough',
        provider: 'snapchat_ads',
        redirectUri:
          'https://usebaci.com/api/integrations/ads/snapchat/callback',
        userId: 'user',
      },
      'x'.repeat(32)
    );
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest(
        `https://usebaci.com/api/integrations/ads/snapchat/callback?code=replay&state=${encodeURIComponent(state)}`,
        { headers: { cookie: `baci_snapchat_ads_oauth_state=${state}` } }
      )
    );
    expect(response.headers.get('location')).toContain('reason=invalid_state');
    expect(rpc).toHaveBeenCalledWith(
      'consume_snapchat_ads_oauth_state_nonce',
      expect.objectContaining({ p_nonce: 'nonce-value-that-is-long-enough' })
    );
  });
});
