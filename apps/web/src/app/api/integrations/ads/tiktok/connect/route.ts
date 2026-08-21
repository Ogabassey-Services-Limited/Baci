import { type NextRequest, NextResponse } from 'next/server';
import { generateAdsRandomValue } from '@/lib/ads/crypto';
import { createAdsOAuthState } from '@/lib/ads/state';
import {
  getTikTokAdsConfig,
  TIKTOK_ADS_CONFIG_MISSING,
  TikTokAdsConfigError,
} from '@/lib/ads/tiktok/config';
import {
  TIKTOK_ADS_OAUTH_COOKIE_MAX_AGE,
  TIKTOK_ADS_PROVIDER,
  TIKTOK_ADS_STATE_COOKIE,
} from '@/lib/ads/tiktok/constants';
import { buildTikTokAdsAuthorizationUrl } from '@/lib/ads/tiktok/oauth';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const access = await getUserAccess(auth.supabase);
  if (!access)
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  if (!hasPermission(access, 'integrations', 'manage'))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  try {
    const config = getTikTokAdsConfig();
    const state = createAdsOAuthState(
      {
        merchantId: access.merchantId,
        nonce: generateAdsRandomValue(24),
        provider: TIKTOK_ADS_PROVIDER,
        redirectUri: config.redirectUri,
        userId: auth.user.id,
      },
      config.oauthStateSecret
    );
    const response = NextResponse.redirect(
      buildTikTokAdsAuthorizationUrl(config, state)
    );
    response.cookies.set(TIKTOK_ADS_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: TIKTOK_ADS_OAUTH_COOKIE_MAX_AGE,
      path: '/api/integrations/ads/tiktok',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof TikTokAdsConfigError
            ? TIKTOK_ADS_CONFIG_MISSING
            : 'TikTok Ads integration unavailable',
      },
      { status: 503 }
    );
  }
}
