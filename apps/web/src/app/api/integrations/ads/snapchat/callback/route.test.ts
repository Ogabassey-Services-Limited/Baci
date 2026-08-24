import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnapchatAdsConfigError } from '@/lib/ads/snapchat/config';
import { createAdsOAuthState } from '@/lib/ads/state';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
const config = vi.fn();
const exchange = vi.fn();
const resolveMerchant = vi.fn();
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));
vi.mock('@/lib/ads/merchant-context', () => ({
  resolveAdsMerchantAccess: (...args: unknown[]) => resolveMerchant(...args),
}));
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) => invalidate(...args),
}));
vi.mock('@/lib/ads/snapchat/config', () => ({
  getSnapchatAdsConfig: () => config(),
  SnapchatAdsConfigError: class SnapchatAdsConfigError extends Error {},
}));
vi.mock('@/lib/ads/snapchat/oauth', () => ({
  exchangeSnapchatAdsAuthorizationCode: (...args: unknown[]) =>
    exchange(...args),
}));

function snapchatConfig() {
  return {
    oauthStateSecret: 'x'.repeat(32),
    redirectUri: 'https://usebaci.com/api/integrations/ads/snapchat/callback',
    tokenEncryptionKey: Buffer.alloc(32, 7).toString('base64url'),
  };
}

function signedState() {
  return createAdsOAuthState(
    {
      merchantId: 'merchant',
      nonce: 'nonce-value-that-is-long-enough',
      provider: 'snapchat_ads',
      redirectUri: 'https://usebaci.com/api/integrations/ads/snapchat/callback',
      userId: 'user',
    },
    'x'.repeat(32)
  );
}

import { GET } from './route';

describe('Snapchat Ads callback route', () => {
  beforeEach(() => {
    resolveMerchant.mockResolvedValue({
      access: { merchantId: 'merchant' },
      response: null,
    });
  });

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
    config.mockReturnValue(snapchatConfig());
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
    config.mockReturnValue(snapchatConfig());
    const state = signedState();
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

  it('consumes the exact nonce, exchanges tokens, and persists encrypted ciphertext only', async () => {
    config.mockReturnValue(snapchatConfig());
    const state = signedState();
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    exchange.mockResolvedValue({
      accessToken: 'SNAP_CALLBACK_ACCESS_SENTINEL',
      expiresIn: 3600,
      refreshToken: 'SNAP_CALLBACK_REFRESH_SENTINEL',
      scopes: ['snapchat-marketing-api'],
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await GET(
      new NextRequest(
        `https://usebaci.com/api/integrations/ads/snapchat/callback?code=code&state=${encodeURIComponent(state)}`,
        { headers: { cookie: `baci_snapchat_ads_oauth_state=${state}` } }
      )
    );
    expect(response.headers.get('location')).toContain(
      'snapchat_ads=connected'
    );
    expect(JSON.stringify(Object.fromEntries(response.headers))).not.toContain(
      'SNAP_CALLBACK_ACCESS_SENTINEL'
    );
    const upsert = rpc.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(upsert.p_access_token_ciphertext).not.toBe(
      'SNAP_CALLBACK_ACCESS_SENTINEL'
    );
    expect(upsert.p_refresh_token_ciphertext).not.toBe(
      'SNAP_CALLBACK_REFRESH_SENTINEL'
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(
      'SNAP_CALLBACK_ACCESS_SENTINEL'
    );
    expect(invalidate).toHaveBeenCalledWith('merchant');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('returns safe redirects for provider failures, denied scopes, and missing configuration', async () => {
    config.mockReturnValue(snapchatConfig());
    const state = signedState();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    auth.mockResolvedValue({
      error: null,
      supabase: { rpc },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    exchange.mockRejectedValueOnce(new Error('SNAP_TOKEN_SENTINEL'));
    const providerFailure = await GET(
      new NextRequest(
        `https://usebaci.com/api/integrations/ads/snapchat/callback?code=code&state=${encodeURIComponent(state)}`,
        { headers: { cookie: `baci_snapchat_ads_oauth_state=${state}` } }
      )
    );
    expect(providerFailure.headers.get('location')).toContain(
      'reason=token_exchange_failed'
    );
    expect(
      JSON.stringify(Object.fromEntries(providerFailure.headers))
    ).not.toContain('SNAP_TOKEN_SENTINEL');

    exchange.mockResolvedValueOnce({
      accessToken: 'access',
      expiresIn: 3600,
      refreshToken: 'refresh',
      scopes: [],
    });
    const scopeFailure = await GET(
      new NextRequest(
        `https://usebaci.com/api/integrations/ads/snapchat/callback?code=code&state=${encodeURIComponent(state)}`,
        { headers: { cookie: `baci_snapchat_ads_oauth_state=${state}` } }
      )
    );
    expect(scopeFailure.headers.get('location')).toContain(
      'reason=required_scopes_missing'
    );

    config.mockImplementationOnce(() => {
      throw new SnapchatAdsConfigError('SNAP_CONFIG_SENTINEL');
    });
    const configFailure = await GET(
      new NextRequest(
        `https://usebaci.com/api/integrations/ads/snapchat/callback?code=code&state=${encodeURIComponent(state)}`,
        { headers: { cookie: `baci_snapchat_ads_oauth_state=${state}` } }
      )
    );
    expect(configFailure.headers.get('location')).toContain(
      'reason=not_configured'
    );
    expect(
      JSON.stringify(Object.fromEntries(configFailure.headers))
    ).not.toContain('SNAP_CONFIG_SENTINEL');
  });
});
