/**
 * Jumia OAuth Callback Route
 * Handles the return from Jumia OAuth authorization flow
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { JumiaClient } from '@/lib/jumia/client';
import { exchangeJumiaCode } from '@/lib/jumia/helpers';
import { logger } from '@/lib/logger';

// biome-ignore lint/style/noNonNullAssertion: Env vars checked in config
const JUMIA_CLIENT_ID = process.env.JUMIA_CLIENT_ID!;
// biome-ignore lint/style/noNonNullAssertion: Env vars checked in config
const JUMIA_CLIENT_SECRET = process.env.JUMIA_CLIENT_SECRET!;
const JUMIA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/marketplace/jumia/callback`;

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
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=invalid_state', request.url)
      );
    }

    // 2. Auth: verify user session
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      logger.error({
        message: 'Jumia Callback Unauthorized',
        error: auth.error,
      });
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=session_expired', request.url)
      );
    }

    // 3. Merchant: verify ownership
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      logger.error({ message: 'Jumia Callback Merchant not found' });
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=merchant_not_found', request.url)
      );
    }

    if (cookieMerchantId && cookieMerchantId !== merchantId) {
      logger.error({
        message: 'Jumia Callback Merchant mismatch',
        cookieMerchantId,
        merchantId,
      });
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=session_expired', request.url)
      );
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
      return NextResponse.redirect(
        new URL(
          `/dashboard/channels?error=${encodeURIComponent(safeError)}`,
          request.url
        )
      );
    }

    if (!code || code.length > 2048) {
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeJumiaCode({
      code,
      clientId: JUMIA_CLIENT_ID,
      clientSecret: JUMIA_CLIENT_SECRET,
      redirectUri: JUMIA_REDIRECT_URI,
    });

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

    // Upsert all discovered shops (Master Shops have multiple)
    for (const shop of discoveredShops) {
      const shopId = shop.id;
      const shopName = shop.name || 'Jumia Shop';
      // Nigeria-pilot: prefer NG business client, fall back to first entry, then 'NG' default
      const countryCode = shop.businessClients?.some(
        (bc) => bc.countryCode === 'NG'
      )
        ? 'NG'
        : (shop.businessClients?.[0]?.countryCode ?? 'NG');

      const { error: insertError } = await supabase
        .from('marketplace_integrations')
        .upsert(
          {
            merchant_id: merchantId,
            platform: 'jumia',
            shop_id: shopId,
            shop_name: shopName,
            country_code: countryCode,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt.toISOString(),
            is_active: !isFallbackShop,
            sync_config: {
              products: true,
              orders: true,
              stock: true,
              businessClients: shop.businessClients ?? [],
            },
          },
          {
            onConflict: 'merchant_id,platform,shop_id',
          }
        );

      if (insertError) {
        logger.error({
          message: 'Jumia Callback Database error for shop',
          shopId,
          error: insertError,
        });
      }
    }

    const platform = request.cookies.get('jumia_oauth_platform')?.value;

    // Check where to redirect
    const redirectBase =
      platform === 'mobile' ? 'baciadmin://' : '/dashboard/channels';

    // Clear OAuth cookies
    const response = NextResponse.redirect(
      new URL(
        `${redirectBase}?success=jumia_connected`,
        platform === 'mobile' ? undefined : request.url
      )
    );

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
    logger.error({ message: 'Jumia Callback internal error', error });
    const platform = request.cookies.get('jumia_oauth_platform')?.value;
    const redirectBase =
      platform === 'mobile' ? 'baciadmin://' : '/dashboard/channels';

    return NextResponse.redirect(
      new URL(
        `${redirectBase}?error=connection_failed`,
        platform === 'mobile' ? undefined : request.url
      )
    );
  }
}
