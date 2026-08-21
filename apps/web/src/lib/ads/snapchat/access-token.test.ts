import { describe, expect, it, vi } from 'vitest';
import { encryptAdsToken } from '@/lib/ads/crypto';

const refresh = vi.fn();
vi.mock('./oauth', () => ({
  refreshSnapchatAdsAccessToken: (...args: unknown[]) => refresh(...args),
}));

import {
  getSnapchatAdsUsableAccessToken,
  resolveSnapchatAdsAccessToken,
} from './access-token';

const tokenEncryptionKey = Buffer.alloc(32, 6).toString('base64url');
const config = {
  clientId: 'client',
  clientSecret: 'secret',
  oauthStateSecret: 'state'.repeat(8),
  redirectUri: 'https://usebaci.com/api/integrations/ads/snapchat/callback',
  tokenEncryptionKey,
};

describe('Snapchat Ads access token', () => {
  it('requires a stored encrypted access token', () => {
    expect(() =>
      resolveSnapchatAdsAccessToken(
        {
          access_token_ciphertext: null,
          refresh_token_ciphertext: null,
          token_expires_at: null,
        },
        {} as never
      )
    ).toThrow('SNAPCHAT_ADS_REAUTH_REQUIRED');
  });

  it('atomically replaces both encrypted tokens after a successful refresh', async () => {
    const oldRefreshCiphertext = encryptAdsToken(
      'old-refresh',
      tokenEncryptionKey,
      'snapchat_ads'
    );
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    refresh.mockResolvedValue({
      accessToken: 'new-access',
      expiresIn: 3600,
      refreshToken: 'new-refresh',
      scopes: ['snapchat-marketing-api'],
    });
    await expect(
      getSnapchatAdsUsableAccessToken({
        config,
        connection: {
          access_token_ciphertext: encryptAdsToken(
            'old-access',
            tokenEncryptionKey,
            'snapchat_ads'
          ),
          refresh_token_ciphertext: oldRefreshCiphertext,
          token_expires_at: '2020-01-01T00:00:00Z',
        },
        merchantId: 'merchant',
        supabase: { rpc } as never,
      })
    ).resolves.toBe('new-access');
    expect(rpc).toHaveBeenCalledWith(
      'update_snapchat_ads_connection_tokens',
      expect.objectContaining({
        p_current_refresh_token_ciphertext: oldRefreshCiphertext,
        p_refresh_token_ciphertext: expect.not.stringContaining('new-refresh'),
      })
    );
  });

  it('fails closed when token persistence loses a concurrent refresh race', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    refresh.mockResolvedValue({
      accessToken: 'new-access',
      expiresIn: 3600,
      refreshToken: 'new-refresh',
      scopes: [],
    });
    await expect(
      getSnapchatAdsUsableAccessToken({
        config,
        connection: {
          access_token_ciphertext: encryptAdsToken(
            'old-access',
            tokenEncryptionKey,
            'snapchat_ads'
          ),
          refresh_token_ciphertext: encryptAdsToken(
            'old-refresh',
            tokenEncryptionKey,
            'snapchat_ads'
          ),
          token_expires_at: '2020-01-01T00:00:00Z',
        },
        merchantId: 'merchant',
        supabase: { rpc } as never,
      })
    ).rejects.toMatchObject({
      code: 'SNAPCHAT_ADS_TOKEN_REFRESH_WRITE_FAILED',
    });
  });
});
