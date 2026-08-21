import { type NextRequest, NextResponse } from 'next/server';
import { encryptAdsToken, timingSafeStringEqual } from '@/lib/ads/crypto';
import { getMetaAdsConfig, MetaAdsConfigError } from '@/lib/ads/meta/config';
import {
  META_ADS_PROVIDER,
  META_ADS_STATE_COOKIE,
} from '@/lib/ads/meta/constants';
import {
  exchangeMetaAdsAuthorizationCode,
  exchangeMetaAdsLongLivedToken,
  MetaAdsOAuthError,
} from '@/lib/ads/meta/oauth';
import {
  MetaAdsProviderError,
  validateMetaAdsGrant,
} from '@/lib/ads/meta/provider';
import { verifyAdsOAuthState } from '@/lib/ads/state';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { metaAdsOAuthCallbackQuerySchema } from '@/schemas/meta-ads';

function callbackRedirect(
  result: 'connected' | 'error',
  reason?: string
): NextResponse {
  const target = new URL('https://usebaci.com/dashboard/analytics');
  target.searchParams.set('meta_ads', result);
  if (reason) target.searchParams.set('reason', reason);
  const response = NextResponse.redirect(target);
  response.cookies.delete(META_ADS_STATE_COOKIE);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const parsedQuery = metaAdsOAuthCallbackQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsedQuery.success)
    return callbackRedirect('error', 'invalid_callback');
  let config: ReturnType<typeof getMetaAdsConfig>;
  try {
    config = getMetaAdsConfig();
  } catch (error) {
    return callbackRedirect(
      'error',
      error instanceof MetaAdsConfigError ? 'not_configured' : 'unavailable'
    );
  }
  const state = parsedQuery.data.state;
  const storedState = request.cookies.get(META_ADS_STATE_COOKIE)?.value;
  if (!state || !storedState || !timingSafeStringEqual(state, storedState))
    return callbackRedirect('error', 'invalid_state');
  const access = await getUserAccess(auth.supabase);
  if (!access) return callbackRedirect('error', 'merchant_mismatch');
  if (!hasPermission(access, 'integrations', 'manage'))
    return callbackRedirect('error', 'forbidden');
  const verifiedState = verifyAdsOAuthState(state, config.oauthStateSecret, {
    merchantId: access.merchantId,
    provider: META_ADS_PROVIDER,
    redirectUri: config.redirectUri,
    userId: auth.user.id,
  });
  if (!verifiedState) return callbackRedirect('error', 'invalid_state');
  const { data: nonceConsumed, error: nonceConsumeError } =
    await auth.supabase.rpc('consume_merchant_ads_oauth_state_nonce', {
      p_merchant_id: access.merchantId,
      p_nonce: verifiedState.nonce,
      p_provider: META_ADS_PROVIDER,
      p_redirect_uri: config.redirectUri,
      p_user_id: auth.user.id,
    });
  if (nonceConsumeError || !nonceConsumed)
    return callbackRedirect('error', 'invalid_state');
  if (parsedQuery.data.error)
    return callbackRedirect('error', 'provider_denied');
  if (!parsedQuery.data.code) return callbackRedirect('error', 'missing_code');
  try {
    const shortLived = await exchangeMetaAdsAuthorizationCode({
      ...config,
      code: parsedQuery.data.code,
    });
    const longLived = await exchangeMetaAdsLongLivedToken({
      ...config,
      accessToken: shortLived.access_token,
    });
    const grant = await validateMetaAdsGrant({
      accessToken: longLived.access_token,
      appId: config.appId,
      appSecret: config.appSecret,
    });
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;
    const { error } = await auth.supabase.rpc(
      'upsert_merchant_ads_connection',
      {
        p_access_token_ciphertext: encryptAdsToken(
          longLived.access_token,
          config.tokenEncryptionKey,
          META_ADS_PROVIDER
        ),
        p_account_timezone: null,
        p_attribution_metadata: {
          provider: 'meta_ads',
          providerVersion: 'v25.0',
        },
        p_merchant_id: access.merchantId,
        p_metadata: {
          graphVersion: 'v25.0',
          providerUserId: grant.providerUserId,
        },
        p_provider: META_ADS_PROVIDER,
        p_provider_account_label: null,
        p_provider_customer_id: null,
        p_refresh_token_ciphertext: null,
        p_scopes: ['ads_read'],
        p_status: 'active',
        p_token_expires_at: expiresAt,
      }
    );
    if (error) return callbackRedirect('error', 'connection_write_failed');
  } catch (error) {
    if (
      error instanceof MetaAdsOAuthError ||
      error instanceof MetaAdsProviderError
    )
      return callbackRedirect('error', error.code.toLowerCase());
    return callbackRedirect('error', 'token_exchange_failed');
  }
  return callbackRedirect('connected');
}
