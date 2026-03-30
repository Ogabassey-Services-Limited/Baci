import { type NextRequest, NextResponse } from 'next/server';
import {
  getConfiguredAppUrl,
  getJumiaClientId,
  getJumiaClientSecret,
} from '@/env';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';
import {
  exchangeJumiaCode,
  getJumiaRedirectUri,
  sanitizeJumiaErrorDetails,
} from '@/lib/jumia/helpers';
import { logger } from '@/lib/logger';

/** RFC 6749 standard error codes plus common Jumia-specific ones. */
const KNOWN_OAUTH_ERRORS = new Set([
  'access_denied',
  'invalid_request',
  'unauthorized_client',
  'server_error',
  'temporarily_unavailable',
  'invalid_scope',
]);

const MOBILE_JUMIA_RETURN_URL = 'baciadmin:///sales-channels';

function clearOAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete('jumia_oauth_state');
  response.cookies.delete('jumia_merchant_id');
  response.cookies.delete('jumia_oauth_platform');
  response.cookies.delete('jumia_ticket_id');
  return response;
}

function createPlatformRedirect(
  request: NextRequest,
  query: string
): NextResponse {
  const platform = request.cookies.get('jumia_oauth_platform')?.value;
  const redirectBase =
    platform === 'mobile' ? MOBILE_JUMIA_RETURN_URL : '/dashboard/channels';

  return NextResponse.redirect(
    new URL(
      `${redirectBase}?${query}`,
      platform === 'mobile' ? undefined : request.url
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const rawError = searchParams.get('error');
    const cookieMerchantId = request.cookies.get('jumia_merchant_id')?.value;

    const storedState = request.cookies.get('jumia_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      logger.error({
        message: 'Jumia Callback State mismatch',
        state: `${state?.slice(0, 8)}...`,
        storedState: `${storedState?.slice(0, 8)}...`,
      });
      return clearOAuthCookies(
        createPlatformRedirect(request, 'error=invalid_state')
      );
    }

    // Mobile flow: pass code back via deep link, don't exchange here
    if (request.cookies.get('jumia_oauth_platform')?.value === 'mobile') {
      if (rawError) {
        const safeError = KNOWN_OAUTH_ERRORS.has(rawError)
          ? rawError
          : 'oauth_error';
        return clearOAuthCookies(
          createPlatformRedirect(request, `error=${safeError}`)
        );
      }
      if (!code || code.length > 2048) {
        return clearOAuthCookies(
          createPlatformRedirect(request, 'error=no_code')
        );
      }

      const ticketId = request.cookies.get('jumia_ticket_id')?.value;
      if (!ticketId || ticketId.length > 200) {
        return clearOAuthCookies(
          createPlatformRedirect(request, 'error=ticket_invalid')
        );
      }

      const response = NextResponse.redirect(
        new URL(
          `${MOBILE_JUMIA_RETURN_URL}?code=${encodeURIComponent(code)}&ticketId=${encodeURIComponent(ticketId)}`
        )
      );
      return clearOAuthCookies(response);
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      logger.error({
        message: 'Jumia Callback Unauthorized',
        error: auth.error,
      });
      return createPlatformRedirect(request, 'error=session_expired');
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      logger.error({ message: 'Jumia Callback Merchant not found' });
      return createPlatformRedirect(request, 'error=merchant_not_found');
    }

    if (cookieMerchantId && cookieMerchantId !== merchantId) {
      logger.error({
        message: 'Jumia Callback Merchant mismatch',
        cookieMerchantId,
        merchantId,
      });
      return createPlatformRedirect(request, 'error=session_expired');
    }

    if (rawError) {
      const safeError = KNOWN_OAUTH_ERRORS.has(rawError)
        ? rawError
        : 'oauth_error';
      logger.error({
        message: 'Jumia Callback OAuth error',
        error: safeError,
        merchantId,
      });
      return createPlatformRedirect(
        request,
        `error=${encodeURIComponent(safeError)}`
      );
    }

    if (!code || code.length > 2048) {
      return createPlatformRedirect(request, 'error=no_code');
    }

    const jumiaClientId = getJumiaClientId();
    const jumiaClientSecret = getJumiaClientSecret();
    const appUrl = getConfiguredAppUrl();

    if (!jumiaClientId || !jumiaClientSecret || !appUrl) {
      logger.error({
        message: 'Jumia Callback OAuth credentials missing',
        merchantId,
        hasClientId: Boolean(jumiaClientId),
        hasClientSecret: Boolean(jumiaClientSecret),
        hasAppUrl: Boolean(appUrl),
      });
      return createPlatformRedirect(request, 'error=oauth_not_configured');
    }
    const jumiaRedirectUri = getJumiaRedirectUri(appUrl);

    let tokens: Awaited<ReturnType<typeof exchangeJumiaCode>>;
    try {
      tokens = await exchangeJumiaCode({
        code,
        clientId: jumiaClientId,
        clientSecret: jumiaClientSecret,
        redirectUri: jumiaRedirectUri,
      });
    } catch (tokenError) {
      const tokenErrorDetails = sanitizeJumiaErrorDetails(
        (tokenError as Error & { details?: unknown }).details
      );
      logger.error({
        message: 'Jumia Callback Token exchange failed',
        merchantId,
        redirectUri: jumiaRedirectUri,
        error:
          tokenError instanceof Error
            ? {
                name: tokenError.name,
                message: tokenError.message,
                status: (tokenError as Error & { status?: number }).status,
                ...(tokenErrorDetails === undefined
                  ? {}
                  : { details: tokenErrorDetails }),
              }
            : String(tokenError).slice(0, 200),
      });
      return createPlatformRedirect(request, 'error=token_exchange_failed');
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const tempClient = new JumiaClient({
      integrationId: 'temp',
      merchantId,
      shopId: 'oauth',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiresAt: tokenExpiresAt,
      supabase: auth.supabase,
    });

    let discoveredShops: Awaited<ReturnType<typeof tempClient.getShops>>;
    try {
      discoveredShops = await tempClient.getShops();
    } catch (shopError) {
      logger.error({
        message: 'Jumia Callback Failed to fetch shops, using fallback',
        merchantId,
        error:
          shopError instanceof Error
            ? {
                message: shopError.message,
                code: (shopError as Error & { code?: string }).code,
              }
            : 'Unknown error',
      });
      discoveredShops = [];
    }
    const supabase = auth.supabase;
    const { data: existingIntegrations, error: existingIntegrationsError } =
      await supabase
        .from('marketplace_integrations')
        .select('shop_id,is_active')
        .eq('merchant_id', merchantId)
        .eq('platform', 'jumia');

    if (existingIntegrationsError) {
      logger.error({
        message: 'Jumia Callback Failed to load existing integrations',
        merchantId,
        error: existingIntegrationsError,
      });
      return createPlatformRedirect(request, 'error=database_error');
    }
    const existingActiveShopIds = new Set(
      (existingIntegrations ?? [])
        .filter((integration) => integration.is_active)
        .map((integration) => integration.shop_id)
    );

    let isFallbackShop = false;
    if (discoveredShops.length === 0) {
      logger.warn({
        message: 'Jumia Callback No shops discovered',
        merchantId,
      });
      isFallbackShop = true;
      discoveredShops.push({
        id: 'oauth',
        name: 'Jumia Shop',
        email: '',
        businessClients: [
          {
            name: 'Jumia Nigeria',
            code: 'jumia_ng',
            countryCode: 'NG',
            countryName: 'Nigeria',
            status: 'active',
            shortCode: 'NG',
          },
        ],
      });
    }

    const integrationRows = discoveredShops.map((shop) => ({
      merchant_id: merchantId,
      platform: 'jumia' as const,
      shop_id: shop.id,
      shop_name: shop.name || 'Jumia Shop',
      country_code: shop.businessClients?.some((bc) => bc.countryCode === 'NG')
        ? 'NG'
        : (shop.businessClients?.[0]?.countryCode ?? 'NG'),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: tokenExpiresAt.toISOString(),
      is_active: !isFallbackShop,
      sync_config: {
        products: true,
        orders: true,
        stock: true,
        businessClients: shop.businessClients ?? [],
      },
    }));

    const { error: insertError } = await supabase
      .from('marketplace_integrations')
      .upsert(integrationRows, {
        onConflict: 'merchant_id,platform,shop_id',
      });

    if (insertError) {
      logger.error({
        message: 'Jumia Callback Database error while persisting shops',
        shopIds: integrationRows.map((row) => row.shop_id),
        error: insertError,
      });
      return createPlatformRedirect(request, 'error=database_error');
    }

    const newShopIds = integrationRows
      .filter(
        (integration) =>
          integration.is_active &&
          !existingActiveShopIds.has(integration.shop_id)
      )
      .map((integration) => integration.shop_id);
    const redirectQuery =
      newShopIds.length > 0
        ? `success=jumia_connected&shops=${encodeURIComponent(newShopIds.join(','))}`
        : 'success=jumia_connected';
    const response = createPlatformRedirect(request, redirectQuery);
    return clearOAuthCookies(response);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    logger.error({
      message: 'Jumia Callback internal error',
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : {
              kind: 'NonError',
              type: typeof error,
              summary: String(error).slice(0, 200),
            },
    });
    return createPlatformRedirect(request, 'error=connection_failed');
  }
}
