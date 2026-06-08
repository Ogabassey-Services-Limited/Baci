import { describe, expect, it, vi } from 'vitest';
import {
  buildZohoCampaignsAuthorizationUrl,
  exchangeZohoAuthorizationCodeForTokens,
} from './zoho-campaigns-oauth';

const oauthConfig = {
  accountsServerUrl: 'https://accounts.zoho.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  oauthState: 'state-123',
  redirectUri: 'https://ogabassey.com/api/integrations/zoho/callback',
};

describe('Zoho Campaigns OAuth helpers', () => {
  it('builds an offline consent URL for blog campaign scopes', () => {
    const url = new URL(buildZohoCampaignsAuthorizationUrl(oauthConfig));

    expect(url.origin).toBe('https://accounts.zoho.com');
    expect(url.pathname).toBe('/oauth/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('scope')).toContain(
      'ZohoCampaigns.campaign.CREATE'
    );
    expect(url.searchParams.get('scope')).toContain(
      'ZohoCampaigns.campaign.UPDATE'
    );
  });

  it('throws when required OAuth config is missing', () => {
    expect(() =>
      buildZohoCampaignsAuthorizationUrl({
        ...oauthConfig,
        clientId: undefined,
      })
    ).toThrow('ZOHO_CAMPAIGNS_CLIENT_ID');

    expect(() =>
      buildZohoCampaignsAuthorizationUrl({
        ...oauthConfig,
        oauthState: undefined,
      })
    ).toThrow('ZOHO_CAMPAIGNS_OAUTH_STATE');
  });

  it('exchanges an authorization code with x-www-form-urlencoded body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          expires_in: 3600,
          refresh_token: 'refresh-token',
          token_type: 'Bearer',
        }),
        { status: 200 }
      )
    );

    const tokens = await exchangeZohoAuthorizationCodeForTokens(
      { ...oauthConfig, code: 'grant-code' },
      fetchImpl
    );

    expect(tokens.refresh_token).toBe('refresh-token');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://accounts.zoho.com/oauth/v2/token',
      expect.objectContaining({ method: 'POST' })
    );
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('grant-code');
    expect(body.get('redirect_uri')).toBe(oauthConfig.redirectUri);
  });

  it('throws a ZohoCampaignsError with status code for failed token exchange', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_code' }), {
        status: 400,
      })
    );

    await expect(
      exchangeZohoAuthorizationCodeForTokens(
        { ...oauthConfig, code: 'bad-code' },
        fetchImpl
      )
    ).rejects.toMatchObject({
      message: 'Zoho OAuth token exchange failed',
      name: 'ZohoCampaignsError',
      statusCode: 400,
    });
  });

  it('throws a validation error when Zoho returns an invalid token payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: 'refresh-token' }), {
        status: 200,
      })
    );

    await expect(
      exchangeZohoAuthorizationCodeForTokens(
        { ...oauthConfig, code: 'grant-code' },
        fetchImpl
      )
    ).rejects.toThrow();
  });
});
