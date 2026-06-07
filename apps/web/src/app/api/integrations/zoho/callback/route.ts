import { NextResponse } from 'next/server';
import { getZohoCampaignsOAuthConfig } from '@/env';
import { createClient } from '@/lib/supabase/server';
import { requireZohoOAuthFields } from '@/lib/zoho-campaigns-http';
import { exchangeZohoAuthorizationCodeForTokens } from '@/lib/zoho-campaigns-oauth';
import { ZohoCampaignsError } from '@/lib/zoho-campaigns-types';
import { zohoCallbackQuerySchema } from '@/schemas/zoho-callback-query';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsedQuery = zohoCallbackQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid Zoho callback query' },
      { status: 400 }
    );
  }

  if (parsedQuery.data.error) {
    return NextResponse.json(
      {
        error: parsedQuery.data.error,
        errorDescription: parsedQuery.data.error_description,
      },
      { status: 400 }
    );
  }

  if (!parsedQuery.data.code) {
    return NextResponse.json({ error: 'Missing Zoho code' }, { status: 400 });
  }

  const config = getZohoCampaignsOAuthConfig();
  if (!config.oauthState) {
    return NextResponse.json(
      { error: 'ZOHO_CAMPAIGNS_OAUTH_STATE is not configured' },
      { status: 503 }
    );
  }

  if (parsedQuery.data.state !== config.oauthState) {
    return NextResponse.json({ error: 'Invalid Zoho state' }, { status: 400 });
  }

  const missing = requireZohoOAuthFields(config);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: 'Zoho OAuth config is incomplete',
        missing,
      },
      { status: 503 }
    );
  }

  let tokens: Awaited<
    ReturnType<typeof exchangeZohoAuthorizationCodeForTokens>
  >;
  try {
    tokens = await exchangeZohoAuthorizationCodeForTokens({
      ...config,
      code: parsedQuery.data.code,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Zoho OAuth error';
    console.error('Zoho OAuth token exchange failed', {
      code: error instanceof ZohoCampaignsError ? error.code : undefined,
      error: message,
      statusCode:
        error instanceof ZohoCampaignsError ? error.statusCode : undefined,
    });
    return NextResponse.json(
      {
        error: 'Zoho token exchange failed',
        errorDescription: message,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    apiDomain: tokens.api_domain,
    expiresIn: tokens.expires_in,
    hasRefreshToken: Boolean(tokens.refresh_token),
    message: tokens.refresh_token
      ? 'Store refreshToken in the intended merchant settings. Do not commit it.'
      : 'Zoho did not return a refresh token. Re-authorize with access_type=offline and prompt=consent, or revoke the old grant first.',
    refreshToken: tokens.refresh_token ?? null,
    success: true,
    tokenType: tokens.token_type,
  });
}
