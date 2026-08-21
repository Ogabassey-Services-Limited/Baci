import { type NextRequest, NextResponse } from 'next/server';
import { encryptAdsToken, timingSafeStringEqual } from '@/lib/ads/crypto';
import { verifyAdsOAuthState } from '@/lib/ads/state';
import {
  getTikTokAdsConfig,
  TikTokAdsConfigError,
} from '@/lib/ads/tiktok/config';
import {
  TIKTOK_ADS_PROVIDER,
  TIKTOK_ADS_REQUIRED_SCOPES,
  TIKTOK_ADS_STATE_COOKIE,
} from '@/lib/ads/tiktok/constants';
import {
  exchangeTikTokAdsAuthorizationCode,
  TikTokAdsOAuthError,
} from '@/lib/ads/tiktok/oauth';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { tiktokAdsOAuthCallbackQuerySchema } from '@/schemas/tiktok-ads';

function redirect(
  result: 'connected' | 'error',
  reason?: string
): NextResponse {
  const target = new URL('https://usebaci.com/dashboard/analytics');
  target.searchParams.set('tiktok_ads', result);
  if (reason) target.searchParams.set('reason', reason);
  const response = NextResponse.redirect(target);
  response.cookies.delete(TIKTOK_ADS_STATE_COOKIE);
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
  const query = tiktokAdsOAuthCallbackQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!query.success) return redirect('error', 'invalid_callback');
  let config: ReturnType<typeof getTikTokAdsConfig>;
  try {
    config = getTikTokAdsConfig();
  } catch (error) {
    return redirect(
      'error',
      error instanceof TikTokAdsConfigError ? 'not_configured' : 'unavailable'
    );
  }
  const state = query.data.state;
  const cookie = request.cookies.get(TIKTOK_ADS_STATE_COOKIE)?.value;
  if (!state || !cookie || !timingSafeStringEqual(state, cookie))
    return redirect('error', 'invalid_state');
  const access = await getUserAccess(auth.supabase);
  if (!access) return redirect('error', 'merchant_mismatch');
  if (!hasPermission(access, 'integrations', 'manage'))
    return redirect('error', 'forbidden');
  if (
    !verifyAdsOAuthState(state, config.oauthStateSecret, {
      merchantId: access.merchantId,
      provider: TIKTOK_ADS_PROVIDER,
      redirectUri: config.redirectUri,
      userId: auth.user.id,
    })
  )
    return redirect('error', 'invalid_state');
  if (query.data.error) return redirect('error', 'provider_denied');
  if (!query.data.code) return redirect('error', 'missing_code');
  try {
    const grant = await exchangeTikTokAdsAuthorizationCode({
      ...config,
      code: query.data.code,
    });
    if (
      !TIKTOK_ADS_REQUIRED_SCOPES.every((scope) => grant.scopes.includes(scope))
    )
      return redirect('error', 'required_scopes_missing');
    const { error } = await auth.supabase.rpc(
      'upsert_merchant_ads_connection',
      {
        p_access_token_ciphertext: encryptAdsToken(
          grant.accessToken,
          config.tokenEncryptionKey,
          TIKTOK_ADS_PROVIDER
        ),
        p_account_timezone: null,
        p_attribution_metadata: {
          provider: TIKTOK_ADS_PROVIDER,
          providerVersion: 'v1.3',
        },
        p_merchant_id: access.merchantId,
        p_metadata: {
          authorizedAdvertiserIds: grant.advertiserIds,
          tokenLifecycle: 'long_lived_no_refresh',
        },
        p_provider: TIKTOK_ADS_PROVIDER,
        p_provider_account_label: null,
        p_provider_customer_id: null,
        p_refresh_token_ciphertext: null,
        p_scopes: grant.scopes,
        p_status: 'active',
        p_token_expires_at: null,
      }
    );
    if (error) return redirect('error', 'connection_write_failed');
  } catch (error) {
    return redirect(
      'error',
      error instanceof TikTokAdsOAuthError
        ? error.code.toLowerCase()
        : 'token_exchange_failed'
    );
  }
  return redirect('connected');
}
