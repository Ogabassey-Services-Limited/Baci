/**
 * Jumia OAuth Callback Route
 * Handles the return from Jumia OAuth authorization flow
 */

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

function createPlatformRedirect(
  request: NextRequest,
  query: string
): NextResponse {
  const platform = request.cookies.get('jumia_oauth_platform')?.value;
  const redirectBase =
    platform === 'mobile' ? 'baciadmin://' : '/dashboard/channels';

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

    // ── Security checks FIRST — must not be bypassable by query params ──

    // 1. CSRF: verify state matches (OAuth 2.0 §10.12)
    const storedState = request.cookies.get('jumia_oauth_state')?.value;

    if (!storedState || storedState !== state) {
      logger.error({
        message: 'Jumia Callback State mismatch',
        state: `${state?.slice(0, 8)}...`,
        storedState: `${storedState?.slice(0, 8)}...`,
      });
      return createPlatformRedirect(request, 'error=invalid_state');
    }

    // 2. Auth: verify user session
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      logger.error({
        message: 'Jumia Callback Unauthorized',
        error: auth.error,
      });
      return createPlatformRedirect(request, 'error=session_expired');
    }

    // 3. Merchant: verify ownership
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

    // ── OAuth response handling (after security checks pass) ──

    // Map OAuth error to a known safe value to prevent reflection of arbitrary user input
    const KNOWN_OAUTH_ERRORS = new Set([
      'access_denied',
      'invalid_request',
      'unauthorized_client',
      'server_error',
      'temporarily_unavailable',
      'invalid_scope',
    ]);

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

    // Exchange code for tokens
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

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 2026 Best Practice: Use the unified JumiaClient to discover all shops (Master or Regular)
    // with Zod validation to ensure "No Guessing" implementation.
    const tempClient = new JumiaClient({
      integrationId: 'temp',
      merchantId,
      shopId: 'oauth',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '', // Handle missing refresh token gracefully
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

    // Track whether we had to synthesize a fallback shop (discovery failed).
    // Fallback shops should NOT be marked active — the merchant must manually re-connect.
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
        // Required by JumiaShopSchema (non-nullable); real email is unknown at OAuth time
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

    // Clear OAuth cookies
    const response = createPlatformRedirect(request, 'success=jumia_connected');
    const platform = request.cookies.get('jumia_oauth_platform')?.value;

    response.cookies.delete('jumia_oauth_state');
    response.cookies.delete('jumia_merchant_id');
    if (platform) {
      response.cookies.delete('jumia_oauth_platform');
    }

    return response;
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
