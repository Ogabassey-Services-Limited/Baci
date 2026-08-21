import { type NextRequest, NextResponse } from 'next/server';
import { generateAdsRandomValue } from '@/lib/ads/crypto';
import {
  getMetaAdsConfig,
  META_ADS_CONFIG_MISSING,
  MetaAdsConfigError,
} from '@/lib/ads/meta/config';
import {
  META_ADS_OAUTH_COOKIE_MAX_AGE,
  META_ADS_PROVIDER,
  META_ADS_STATE_COOKIE,
} from '@/lib/ads/meta/constants';
import { buildMetaAdsAuthorizationUrl } from '@/lib/ads/meta/oauth';
import { createAdsOAuthState } from '@/lib/ads/state';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';

function cookieOptions() {
  return {
    httpOnly: true,
    maxAge: META_ADS_OAUTH_COOKIE_MAX_AGE,
    path: '/api/integrations/ads/meta',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

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
  let config: ReturnType<typeof getMetaAdsConfig>;
  try {
    config = getMetaAdsConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof MetaAdsConfigError
            ? META_ADS_CONFIG_MISSING
            : 'Meta Ads integration unavailable',
      },
      { status: 503 }
    );
  }
  const state = createAdsOAuthState(
    {
      merchantId: access.merchantId,
      nonce: generateAdsRandomValue(24),
      provider: META_ADS_PROVIDER,
      redirectUri: config.redirectUri,
      userId: auth.user.id,
    },
    config.oauthStateSecret
  );
  const response = NextResponse.redirect(
    buildMetaAdsAuthorizationUrl(config, state)
  );
  response.cookies.set(META_ADS_STATE_COOKIE, state, cookieOptions());
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
