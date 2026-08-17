import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import { exchangeJumiaCode, getJumiaRedirectUri } from '@/lib/jumia/helpers';
import {
  getActiveSelfAuthorizedJumiaShopIds,
  getJumiaOAuthShopIdsConflictingWithSelfAuthorization,
} from '@/lib/jumia/jumia-oauth-self-authorization-conflict';
import {
  getMerchantFeatureAccess,
  merchantFeatureUpgradeResponse,
} from '@/lib/merchant-feature-gates';
import { createAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  code: z.string().min(1).max(2048),
  ticketId: z.uuid(),
});

/**
 * POST: Exchange a Jumia authorization code for tokens.
 *
 * Mobile-only endpoint. The mobile app receives the code via deep link
 * from the callback, then calls this authenticated endpoint to complete
 * the OAuth flow with its own Supabase session (RLS-enforced).
 */
export async function POST(request: NextRequest) {
  try {
    // No CSRF check required — this endpoint uses Bearer token auth (mobile app),
    // not cookie-based auth. CSRF attacks only exploit automatic cookie inclusion.
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { code, ticketId } = parsed.data;

    const featureAccess = await getMerchantFeatureAccess(
      auth.supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureAccess.error) {
      console.error(
        '[Jumia Exchange] Feature access lookup failed:',
        featureAccess.error
      );
      return NextResponse.json(
        { error: 'Failed to verify merchant plan' },
        { status: 500 }
      );
    }
    if (!featureAccess.allowed) {
      return merchantFeatureUpgradeResponse('marketplace_sync');
    }

    // Atomically consume the ticket — verifies ownership + status + expiry
    const adminClient = createAdminClient();
    const { data: ticket, error: ticketError } = await adminClient
      .from('oauth_handoff_tickets')
      .update({
        status: 'exchanged',
        exchanged_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .eq('status', 'redeemed')
      .eq('user_id', auth.user.id)
      .eq('merchant_id', merchantId)
      .gt('expires_at', new Date().toISOString())
      .select('id')
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Invalid or expired ticket' },
        { status: 403 }
      );
    }

    // Exchange authorization code for tokens
    const jumiaClientId = getJumiaClientId();
    const jumiaClientSecret = getJumiaClientSecret();
    const appUrl = getConfiguredAppUrl();

    if (!jumiaClientId || !jumiaClientSecret || !appUrl) {
      return NextResponse.json(
        { error: 'OAuth not configured' },
        { status: 500 }
      );
    }

    const jumiaRedirectUri = getJumiaRedirectUri(appUrl);
    const tokens = await exchangeJumiaCode({
      code,
      clientId: jumiaClientId,
      clientSecret: jumiaClientSecret,
      redirectUri: jumiaRedirectUri,
    });

    const expiresInSeconds =
      Number.isFinite(tokens.expires_in) && tokens.expires_in > 0
        ? tokens.expires_in
        : 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Discover Jumia shops
    const tempClient = new JumiaClient({
      integrationId: 'temp',
      merchantId,
      shopId: 'oauth',
      marketplaceKey: 'oauth',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiresAt,
      supabase: auth.supabase,
    });

    let discoveredShops: Awaited<ReturnType<typeof tempClient.getShops>>;
    try {
      discoveredShops = await tempClient.getShops();
    } catch (shopError) {
      console.error(
        '[Jumia Exchange] Failed to fetch shops, using fallback:',
        shopError
      );
      discoveredShops = [];
    }

    // Fallback shop if none discovered
    let isFallbackShop = false;
    if (discoveredShops.length === 0) {
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

    // Check existing integrations
    const { data: existingIntegrations } = await auth.supabase
      .from('marketplace_integrations')
      .select('shop_id, is_active, connection_method')
      .eq('merchant_id', merchantId)
      .eq('platform', 'jumia');

    const existingActiveShopIds = new Set(
      (existingIntegrations ?? [])
        .filter((i) => i.is_active)
        .map((i) => i.shop_id)
    );
    const activeSelfAuthorizedShopIds = getActiveSelfAuthorizedJumiaShopIds(
      existingIntegrations ?? []
    );

    if (!isFallbackShop) {
      const conflictingShopIds =
        getJumiaOAuthShopIdsConflictingWithSelfAuthorization(
          discoveredShops.map((shop) => shop.id),
          activeSelfAuthorizedShopIds
        );
      if (conflictingShopIds.length > 0) {
        return NextResponse.json(
          {
            error:
              'This Jumia shop is already connected with self-authorization. Disconnect it before using OAuth.',
            shopIds: conflictingShopIds,
          },
          { status: 409 }
        );
      }
    }

    // Build integration rows
    const integrationRows = discoveredShops.map((shop) => ({
      merchant_id: merchantId,
      platform: 'jumia' as const,
      shop_id: shop.id,
      marketplace_key: 'oauth',
      connection_method: 'oauth' as const,
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

    // Upsert integrations (user-scoped, RLS-enforced)
    const { error: upsertError } = await auth.supabase
      .from('marketplace_integrations')
      .upsert(integrationRows, {
        onConflict: 'merchant_id,platform,shop_id,marketplace_key',
      });

    if (upsertError) {
      console.error('[Jumia Exchange] Upsert failed:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save integrations' },
        { status: 500 }
      );
    }

    const newShopIds = integrationRows
      .filter((i) => i.is_active && !existingActiveShopIds.has(i.shop_id))
      .map((i) => i.shop_id);

    if (isFallbackShop && newShopIds.length === 0) {
      return NextResponse.json({
        success: false,
        incomplete: true,
        message:
          'Connected but no active shops discovered. Please check your Jumia Vendor Center.',
        shops: [],
      });
    }

    return NextResponse.json({
      success: true,
      shops: newShopIds,
    });
  } catch (error) {
    console.error('[Jumia Exchange] Unexpected error:', error);
    return NextResponse.json({ error: 'Exchange failed' }, { status: 500 });
  }
}
