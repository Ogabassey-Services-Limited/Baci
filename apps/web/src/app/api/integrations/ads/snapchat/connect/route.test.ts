import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

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
    clientId: 'client',
    oauthStateSecret: 'x'.repeat(32),
    redirectUri: 'https://usebaci.com/api/integrations/ads/snapchat/callback',
  }),
  SnapchatAdsConfigError: class SnapchatAdsConfigError extends Error {},
}));

import { GET } from './route';

describe('Snapchat Ads connect route', () => {
  it('denies unauthenticated OAuth starts', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/connect'
          )
        )
      ).status
    ).toBe(401);
  });

  it('reserves a server nonce before redirecting to Snap', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/connect'
      )
    );
    expect(response.status).toBe(307);
    expect(rpc).toHaveBeenCalledWith(
      'reserve_snapchat_ads_oauth_state_nonce',
      expect.objectContaining({ p_merchant_id: 'merchant', p_user_id: 'user' })
    );
  });
});
