import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticate = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCsrf = vi.fn();
const mockGetOAuthConfig = vi.fn();
const mockGetReportingConfig = vi.fn();
const mockResolveToken = vi.fn();
const mockListAccounts = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticate(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCsrf(...args),
}));
vi.mock('@/lib/google-ads/config', () => ({
  GOOGLE_ADS_CONFIG_MISSING: 'Google Ads integration is not configured',
  getGoogleAdsOAuthConfig: (...args: unknown[]) => mockGetOAuthConfig(...args),
  getGoogleAdsReportingConfig: (...args: unknown[]) =>
    mockGetReportingConfig(...args),
}));
vi.mock('@/lib/google-ads/access-token', () => ({
  resolveGoogleAdsAccessToken: (...args: unknown[]) =>
    mockResolveToken(...args),
}));
vi.mock('@/lib/google-ads/provider', () => ({
  listGoogleAdsAccessibleCustomerIds: (...args: unknown[]) =>
    mockListAccounts(...args),
}));

import { GET, PATCH } from './route';

const connection = {
  access_token_ciphertext: 'encrypted-access',
  id: 'connection-1',
  provider_customer_id: null,
  refresh_token_ciphertext: 'encrypted-refresh',
  status: 'active',
  token_expires_at: null,
};

describe('Google Ads account discovery and selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      error: null,
      supabase: mockSupabase,
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({ merchantId: 'merchant-1' });
    mockHasPermission.mockReturnValue(true);
    mockCsrf.mockResolvedValue({ valid: true });
    mockGetOAuthConfig.mockReturnValue({
      clientId: 'client',
      clientSecret: 'secret',
      oauthStateSecret: 'state',
      redirectUri: 'https://usebaci.com/api/integrations/ads/google/callback',
      tokenEncryptionKey: 'key',
    });
    mockGetReportingConfig.mockReturnValue({
      developerToken: 'developer-token',
    });
    mockResolveToken.mockResolvedValue({
      accessToken: 'access-token',
      encryptedAccessToken: null,
      expiresAt: null,
    });
    mockListAccounts.mockResolvedValue(['1234567890', '0987654321']);
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_google_ads_connection_secret') {
        return Promise.resolve({ data: [connection], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
  });

  it('returns 401 before account discovery when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValueOnce({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts'
      )
    );
    expect(response.status).toBe(401);
    expect(mockListAccounts).not.toHaveBeenCalled();
  });

  it('lists accessible customer IDs without returning token ciphertext', async () => {
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts'
      )
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.accounts).toEqual([
      { customerId: '1234567890', selected: false },
      { customerId: '0987654321', selected: false },
    ]);
    expect(JSON.stringify(json)).not.toContain('encrypted-access');
  });

  it('does not overwrite a newer OAuth connection when refresh CAS loses the race', async () => {
    mockResolveToken.mockResolvedValueOnce({
      accessToken: 'refreshed-access-token',
      encryptedAccessToken: 'new-encrypted-access',
      expiresAt: '2026-08-22T01:00:00.000Z',
    });
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_google_ads_connection_secret') {
        return Promise.resolve({ data: [connection], error: null });
      }
      if (name === 'update_google_ads_connection_token_if_current') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts'
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Google Ads authorization changed; retry account discovery',
      retry: true,
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'update_google_ads_connection_token_if_current',
      {
        p_access_token_ciphertext: 'new-encrypted-access',
        p_expected_access_token_ciphertext: 'encrypted-access',
        p_expected_refresh_token_ciphertext: 'encrypted-refresh',
        p_merchant_id: 'merchant-1',
        p_token_expires_at: '2026-08-22T01:00:00.000Z',
      }
    );
    expect(mockListAccounts).not.toHaveBeenCalled();
  });

  it('marks the connection for reauthorization when discovery cannot refresh its token', async () => {
    mockResolveToken.mockRejectedValueOnce({
      code: 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED',
      status: 400,
    });

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts'
      )
    );

    expect(response.status).toBe(502);
    expect(mockRpc).toHaveBeenCalledWith(
      'mark_google_ads_connection_reauth_if_current',
      {
        p_access_token_ciphertext: 'encrypted-access',
        p_merchant_id: 'merchant-1',
        p_reason: 'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED',
        p_refresh_token_ciphertext: 'encrypted-refresh',
      }
    );
  });

  it('rejects a syntactically valid customer that Google did not grant', async () => {
    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts',
        {
          body: JSON.stringify({ customerId: '1111111111' }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalledWith(
      'set_google_ads_customer',
      expect.anything()
    );
  });

  it('returns 400 for malformed JSON before provider discovery', async () => {
    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts',
        {
          body: '{',
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );
    expect(response.status).toBe(400);
    expect(mockGetUserAccess).not.toHaveBeenCalled();
    expect(mockListAccounts).not.toHaveBeenCalled();
  });

  it('selects only a discovered customer account', async () => {
    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts',
        {
          body: JSON.stringify({ customerId: '123-456-7890' }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toEqual({ customerId: '1234567890', selected: true });
    expect(mockRpc).toHaveBeenCalledWith('set_google_ads_customer', {
      p_expected_access_token_ciphertext: 'encrypted-access',
      p_merchant_id: 'merchant-1',
      p_provider_customer_id: '1234567890',
    });
  });

  it('rejects a selection when the guarded RPC reports no updated connection', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_google_ads_connection_secret') {
        return Promise.resolve({ data: [connection], error: null });
      }
      if (name === 'set_google_ads_customer') {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });

    const response = await PATCH(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/google/accounts',
        {
          body: JSON.stringify({ customerId: '123-456-7890' }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        }
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Google Ads authorization changed; retry account selection',
    });
  });
});
