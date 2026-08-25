import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockGetConfig = vi.fn();
const mockConstantTimeEqual = vi.fn();
const mockVerifyState = vi.fn();
const mockExchange = vi.fn();
const mockEncrypt = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };
const mockResolveMerchant = vi.fn();
const mockInvalidate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticate(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/ads/merchant-context', () => ({
  resolveAdsMerchantAccess: (...args: unknown[]) =>
    mockResolveMerchant(...args),
}));
vi.mock('@/lib/ads/analytics-cache', () => ({
  invalidateAdsAnalyticsCache: (...args: unknown[]) => mockInvalidate(...args),
}));
vi.mock('@/lib/google-ads/config', () => ({
  GOOGLE_ADS_CONFIG_MISSING: 'Google Ads integration is not configured',
  getGoogleAdsOAuthConfig: (...args: unknown[]) => mockGetConfig(...args),
}));
vi.mock('@/lib/google-ads/crypto', () => ({
  constantTimeStringEqual: (...args: unknown[]) =>
    mockConstantTimeEqual(...args),
  encryptGoogleAdsSecret: (...args: unknown[]) => mockEncrypt(...args),
}));
vi.mock('@/lib/google-ads/oauth', () => ({
  GoogleAdsOAuthError: class GoogleAdsOAuthError extends Error {},
  exchangeGoogleAdsAuthorizationCode: (...args: unknown[]) =>
    mockExchange(...args),
  verifyGoogleAdsOAuthState: (...args: unknown[]) => mockVerifyState(...args),
}));

import { GET } from './route';

describe('GET /api/integrations/ads/google/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      error: null,
      supabase: mockSupabase,
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mockResolveMerchant.mockResolvedValue({
      access: { merchantId: 'merchant-1' },
      response: null,
    });
    mockHasPermission.mockReturnValue(true);
    mockGetConfig.mockReturnValue({
      clientId: 'client',
      clientSecret: 'secret',
      oauthStateSecret: 'state-secret',
      redirectUri: 'https://usebaci.com/api/integrations/ads/google/callback',
      tokenEncryptionKey: 'key',
    });
    mockConstantTimeEqual.mockReturnValue(true);
    mockVerifyState.mockReturnValue({
      merchantId: 'merchant-1',
      nonce: 'nonce',
      userId: 'user-1',
    });
    mockRpc.mockImplementation((name: string) => {
      if (name === 'consume_merchant_ads_oauth_state_nonce') {
        return Promise.resolve({ data: true, error: null });
      }
      if (name === 'get_google_ads_connection_secret') {
        return Promise.resolve({
          data: [
            {
              provider_customer_id: '9876543210',
              refresh_token_ciphertext: 'existing-refresh-ciphertext',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: 'connection-1', error: null });
    });
    mockExchange.mockResolvedValue({
      access_token: 'access-token',
      expires_in: 3600,
      refresh_token: 'refresh-token',
      scope: 'https://www.googleapis.com/auth/adwords',
    });
    mockEncrypt.mockReturnValue('encrypted-secret');
  });

  it('returns 401 before reading OAuth parameters when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await GET(
      new NextRequest(
        'https://evil.example/api/integrations/ads/google/callback'
      )
    );

    expect(response.status).toBe(401);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it('rejects a state mismatch and redirects only to the canonical Baci origin', async () => {
    mockConstantTimeEqual.mockReturnValue(false);
    const response = await GET(
      new NextRequest(
        'https://evil.example/api/integrations/ads/google/callback?state=state&code=code',
        {
          headers: {
            cookie:
              'baci_google_ads_oauth_state=stored; baci_google_ads_oauth_verifier=verifier',
          },
        }
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/dashboard/analytics?google_ads=error&reason=invalid_state'
    );
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it('exchanges the code and stores only encrypted grants', async () => {
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/callback?state=stored&code=code',
        {
          headers: {
            cookie:
              'baci_google_ads_oauth_state=stored; baci_google_ads_oauth_verifier=verifier',
          },
        }
      )
    );

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toMatch(
      /^https:\/\/usebaci\.com\/dashboard\/analytics\?google_ads=connected&cacheBust=\d{1,10}$/
    );
    expect(mockExchange).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'code', codeVerifier: 'verifier' })
    );
    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_google_ads_connection',
      expect.objectContaining({
        p_access_token_ciphertext: 'encrypted-secret',
        p_provider_customer_id: null,
        p_refresh_token_ciphertext: 'encrypted-secret',
      })
    );
    expect(mockInvalidate).toHaveBeenCalledWith('merchant-1');
    expect(JSON.stringify(await response.text())).not.toContain('access-token');
  });

  it('does not reuse an older refresh token when reauthorization omits one', async () => {
    mockExchange.mockResolvedValueOnce({
      access_token: 'new-access-token',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/adwords',
    });

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/callback?state=stored&code=code',
        {
          headers: {
            cookie:
              'baci_google_ads_oauth_state=stored; baci_google_ads_oauth_verifier=verifier',
          },
        }
      )
    );

    expect(response.headers.get('location')).toBe(
      'https://usebaci.com/dashboard/analytics?google_ads=error&reason=offline_access_required'
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      'upsert_google_ads_connection',
      expect.anything()
    );
  });

  it('rejects a nonce replay before exchanging the authorization code', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'consume_merchant_ads_oauth_state_nonce') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/callback?state=stored&code=code',
        {
          headers: {
            cookie:
              'baci_google_ads_oauth_state=stored; baci_google_ads_oauth_verifier=verifier',
          },
        }
      )
    );

    expect(response.headers.get('location')).toContain('reason=invalid_state');
    expect(mockExchange).not.toHaveBeenCalled();
  });
});
