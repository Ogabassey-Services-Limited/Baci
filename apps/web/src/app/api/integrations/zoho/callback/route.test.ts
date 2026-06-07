import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExchangeZohoAuthorizationCodeForTokens,
  mockGetUser,
  mockOauthConfig,
} = vi.hoisted(() => ({
  mockExchangeZohoAuthorizationCodeForTokens: vi.fn(),
  mockGetUser: vi.fn(),
  mockOauthConfig: {
    accountsServerUrl: 'https://accounts.zoho.com',
    clientId: 'client-id' as string | undefined,
    clientSecret: 'client-secret' as string | undefined,
    oauthState: 'expected-state' as string | undefined,
    redirectUri: 'https://ogabassey.com/api/integrations/zoho/callback',
  },
}));

vi.mock('@/env', () => ({
  getZohoCampaignsOAuthConfig: () => mockOauthConfig,
}));

vi.mock('@/lib/zoho-campaigns-oauth', () => ({
  exchangeZohoAuthorizationCodeForTokens: (...args: unknown[]) =>
    mockExchangeZohoAuthorizationCodeForTokens(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { GET } from './route';

describe('GET /api/integrations/zoho/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockOauthConfig, {
      accountsServerUrl: 'https://accounts.zoho.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      oauthState: 'expected-state',
      redirectUri: 'https://ogabassey.com/api/integrations/zoho/callback',
    });
    mockExchangeZohoAuthorizationCodeForTokens.mockResolvedValue({
      api_domain: 'https://api.zoho.com',
      expires_in: 3600,
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('requires an authenticated user before exchanging Zoho tokens', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=expected-state'
      )
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('returns Zoho OAuth errors from the callback query', async () => {
    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?error=access_denied&error_description=Denied'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'access_denied',
      errorDescription: 'Denied',
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('rejects callbacks without a code', async () => {
    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?state=expected-state'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Zoho code',
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('returns 503 when the OAuth state secret is not configured', async () => {
    mockOauthConfig.oauthState = undefined;

    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=expected-state'
      )
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'ZOHO_CAMPAIGNS_OAUTH_STATE is not configured',
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('rejects invalid OAuth state', async () => {
    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=wrong'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid Zoho state',
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('returns 503 when required OAuth fields are missing', async () => {
    mockOauthConfig.clientSecret = undefined;

    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=expected-state'
      )
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Zoho OAuth config is incomplete',
      missing: ['ZOHO_CAMPAIGNS_CLIENT_SECRET'],
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).not.toHaveBeenCalled();
  });

  it('returns a structured error when token exchange fails', async () => {
    mockExchangeZohoAuthorizationCodeForTokens.mockRejectedValue(
      new Error('Zoho OAuth token exchange failed: invalid_code')
    );

    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=expected-state'
      )
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Zoho token exchange failed',
      errorDescription: 'Zoho OAuth token exchange failed: invalid_code',
    });
  });

  it('exchanges a valid Zoho code and returns the refresh token once', async () => {
    const response = await GET(
      new Request(
        'https://ogabassey.com/api/integrations/zoho/callback?code=grant-code&state=expected-state'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      hasRefreshToken: true,
      refreshToken: 'refresh-token',
      success: true,
    });
    expect(mockExchangeZohoAuthorizationCodeForTokens).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'grant-code' })
    );
  });
});
