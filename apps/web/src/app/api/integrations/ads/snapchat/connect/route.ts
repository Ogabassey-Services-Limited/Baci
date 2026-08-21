import { type NextRequest, NextResponse } from 'next/server';
import { generateAdsRandomValue } from '@/lib/ads/crypto';
import {
  getSnapchatAdsConfig,
  SnapchatAdsConfigError,
} from '@/lib/ads/snapchat/config';
import {
  SNAPCHAT_ADS_OAUTH_COOKIE_MAX_AGE,
  SNAPCHAT_ADS_PROVIDER,
  SNAPCHAT_ADS_STATE_COOKIE,
} from '@/lib/ads/snapchat/constants';
import { buildSnapchatAdsAuthorizationUrl } from '@/lib/ads/snapchat/oauth';
import { createAdsOAuthState } from '@/lib/ads/state';
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
    const config = getSnapchatAdsConfig();
    const state = createAdsOAuthState(
      {
        merchantId: access.merchantId,
        nonce: generateAdsRandomValue(24),
        provider: SNAPCHAT_ADS_PROVIDER,
        redirectUri: config.redirectUri,
        userId: auth.user.id,
      },
      config.oauthStateSecret
    );
    const response = NextResponse.redirect(
      buildSnapchatAdsAuthorizationUrl(config, state)
    );
    response.cookies.set(SNAPCHAT_ADS_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: SNAPCHAT_ADS_OAUTH_COOKIE_MAX_AGE,
      path: '/api/integrations/ads/snapchat',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SnapchatAdsConfigError
            ? 'Snapchat Ads integration is not configured'
            : 'Snapchat Ads integration unavailable',
      },
      { status: 503 }
    );
  }
}
