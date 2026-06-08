import type { ZohoCampaignsOAuthConfig } from '@/env';
import { getZohoCampaignsOAuthConfig } from '@/env';
import {
  readJsonResponse,
  requireZohoOAuthFields,
  toFormBody,
  trimTrailingSlash,
  zohoTokenResponseSchema,
} from '@/lib/zoho-campaigns-http';
import {
  type FetchImplementation,
  ZOHO_CAMPAIGNS_BLOG_SCOPES,
  ZohoCampaignsError,
} from '@/lib/zoho-campaigns-types';

type ZohoTokenExchangeInput = ZohoCampaignsOAuthConfig & {
  code: string;
};

export function buildZohoCampaignsAuthorizationUrl(
  config: ZohoCampaignsOAuthConfig = getZohoCampaignsOAuthConfig()
): string {
  const missing = requireZohoOAuthFields(config);
  if (!config.oauthState) missing.push('ZOHO_CAMPAIGNS_OAUTH_STATE');
  if (missing.length > 0) {
    throw new ZohoCampaignsError(
      `Missing Zoho Campaigns OAuth config: ${missing.join(', ')}`
    );
  }

  const url = new URL(
    '/oauth/v2/auth',
    trimTrailingSlash(config.accountsServerUrl)
  );
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId as string);
  url.searchParams.set('scope', ZOHO_CAMPAIGNS_BLOG_SCOPES.join(','));
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', config.oauthState as string);
  return url.toString();
}

export async function exchangeZohoAuthorizationCodeForTokens(
  input: ZohoTokenExchangeInput,
  fetchImpl: FetchImplementation = fetch
) {
  const missing = requireZohoOAuthFields(input);
  if (missing.length > 0) {
    throw new ZohoCampaignsError(
      `Missing Zoho Campaigns OAuth config: ${missing.join(', ')}`
    );
  }

  const response = await fetchImpl(
    `${trimTrailingSlash(input.accountsServerUrl)}/oauth/v2/token`,
    {
      body: toFormBody({
        client_id: input.clientId as string,
        client_secret: input.clientSecret as string,
        code: input.code,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw new ZohoCampaignsError('Zoho OAuth token exchange failed', {
      statusCode: response.status,
    });
  }

  const payload = await readJsonResponse(response);
  return zohoTokenResponseSchema.parse(payload);
}
