/**
 * Jumia OAuth Callback Route
 * Handles the return from Jumia OAuth authorization flow
 */

import { type NextRequest, NextResponse } from 'next/server';
import { exchangeJumiaCode, JumiaClient } from '@/lib/jumia/client';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const error = searchParams.get('error');

    // Jumia may return an error
    if (error) {
      const safeError = encodeURIComponent(String(error).slice(0, 200));
      console.error('[Jumia Callback] OAuth error:', safeError);
      return NextResponse.redirect(
        new URL(
          `/dashboard/channels?error=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=no_code', request.url)
      );
    }

    // Verify state matches
    const storedState = request.cookies.get('jumia_oauth_state')?.value;
    const merchantId = request.cookies.get('jumia_merchant_id')?.value;

    if (!storedState || storedState !== state) {
      console.error('[Jumia Callback] State mismatch');
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=invalid_state', request.url)
      );
    }

    if (!merchantId) {
      console.error('[Jumia Callback] No merchant ID in session');
      return NextResponse.redirect(
        new URL('/dashboard/channels?error=session_expired', request.url)
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
    });

    const discoveredShops = await tempClient.getShops();
    const supabase = createAdminClient();

    if (discoveredShops.length === 0) {
      console.warn('[Jumia Callback] No shops discovered for this account');
      // Fallback to a generic integration if no shops found (unlikely but safe)
      discoveredShops.push({
        id: 'oauth',
        name: 'Jumia Shop',
        country: { code: 'NG' },
      });
    }

    // Upsert all discovered shops (Master Shops have multiple)
    for (const shop of discoveredShops) {
      const shopId = shop.id;
      const shopName = shop.name || 'Jumia Shop';
      const countryCode = shop.country?.code || 'NG';

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
            is_active: true,
            sync_config: { products: true, orders: true, stock: true },
          },
          {
            onConflict: 'merchant_id,platform,shop_id',
          }
        );

      if (insertError) {
        console.error(
          `[Jumia Callback] Database error for shop ${shopId}:`,
          insertError
        );
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
    console.error('[Jumia Callback] Error:', error);
    const platform = request.cookies.get('jumia_oauth_platform')?.value;
    const redirectBase =
      platform === 'mobile' ? 'baciadmin://' : '/dashboard/channels';

    return NextResponse.redirect(
      new URL(
        `${redirectBase}?error=connection_failed&error_description=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )}`,
        platform === 'mobile' ? undefined : request.url
      )
    );
  }
}
