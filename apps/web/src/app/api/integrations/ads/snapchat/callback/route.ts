import { type NextRequest, NextResponse } from 'next/server';
import { encryptAdsToken, timingSafeStringEqual } from '@/lib/ads/crypto';
import {
  getSnapchatAdsConfig,
  SnapchatAdsConfigError,
} from '@/lib/ads/snapchat/config';
import {
  SNAPCHAT_ADS_PROVIDER,
  SNAPCHAT_ADS_REQUIRED_SCOPES,
  SNAPCHAT_ADS_STATE_COOKIE,
} from '@/lib/ads/snapchat/constants';
import { exchangeSnapchatAdsAuthorizationCode } from '@/lib/ads/snapchat/oauth';
import { SnapchatAdsProviderError } from '@/lib/ads/snapchat/provider';
import { verifyAdsOAuthState } from '@/lib/ads/state';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { snapchatAdsOAuthCallbackQuerySchema } from '@/schemas/snapchat-ads';

function redirect(result: 'connected' | 'error', reason?: string) {
  const target = new URL('https://usebaci.com/dashboard/analytics');
  target.searchParams.set('snapchat_ads', result);
  if (reason) target.searchParams.set('reason', reason);
  const response = NextResponse.redirect(target);
  response.cookies.delete(SNAPCHAT_ADS_STATE_COOKIE);
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
  const query = snapchatAdsOAuthCallbackQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!query.success) return redirect('error', 'invalid_callback');
  let config: ReturnType<typeof getSnapchatAdsConfig>;
  try {
    config = getSnapchatAdsConfig();
  } catch (error) {
    return redirect(
      'error',
      error instanceof SnapchatAdsConfigError ? 'not_configured' : 'unavailable'
    );
  }
  const state = query.data.state;
  const cookie = request.cookies.get(SNAPCHAT_ADS_STATE_COOKIE)?.value;
  if (!state || !cookie || !timingSafeStringEqual(state, cookie))
    return redirect('error', 'invalid_state');
  const access = await getUserAccess(auth.supabase);
  if (!access) return redirect('error', 'merchant_mismatch');
  if (!hasPermission(access, 'integrations', 'manage'))
    return redirect('error', 'forbidden');
  if (
    !verifyAdsOAuthState(state, config.oauthStateSecret, {
      merchantId: access.merchantId,
      provider: SNAPCHAT_ADS_PROVIDER,
      redirectUri: config.redirectUri,
      userId: auth.user.id,
    })
  )
    return redirect('error', 'invalid_state');
  if (query.data.error) return redirect('error', 'provider_denied');
  if (!query.data.code) return redirect('error', 'missing_code');
  try {
    const grant = await exchangeSnapchatAdsAuthorizationCode({
      ...config,
      code: query.data.code,
    });
    if (
      !SNAPCHAT_ADS_REQUIRED_SCOPES.every((scope) =>
        grant.scopes.includes(scope)
      )
    )
      return redirect('error', 'required_scopes_missing');
    const { error } = await auth.supabase.rpc(
      'upsert_merchant_ads_connection',
      {
        p_access_token_ciphertext: encryptAdsToken(
          grant.accessToken,
          config.tokenEncryptionKey,
          SNAPCHAT_ADS_PROVIDER
        ),
        p_account_timezone: null,
        p_attribution_metadata: {
          provider: SNAPCHAT_ADS_PROVIDER,
          providerVersion: 'v1',
        },
        p_merchant_id: access.merchantId,
        p_metadata: {
          grantType: 'authorization_code',
          pkce: 'unconfirmed_not_sent',
        },
        p_provider: SNAPCHAT_ADS_PROVIDER,
        p_provider_account_label: null,
        p_provider_customer_id: null,
        p_refresh_token_ciphertext: encryptAdsToken(
          grant.refreshToken,
          config.tokenEncryptionKey,
          SNAPCHAT_ADS_PROVIDER
        ),
        p_scopes: grant.scopes,
        p_status: 'active',
        p_token_expires_at: new Date(
          Date.now() + grant.expiresIn * 1000
        ).toISOString(),
      }
    );
    if (error) return redirect('error', 'connection_write_failed');
  } catch (error) {
    return redirect(
      'error',
      error instanceof SnapchatAdsProviderError
        ? error.code.toLowerCase()
        : 'token_exchange_failed'
    );
  }
  return redirect('connected');
}
