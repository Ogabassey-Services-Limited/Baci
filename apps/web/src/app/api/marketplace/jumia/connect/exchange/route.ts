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
import { buildJumiaOAuthIntegrationRows } from './build-jumia-oauth-integration-rows';
import {
  claimJumiaOAuthHandoffTicket,
  finalizeJumiaOAuthHandoffTicket,
  releaseJumiaOAuthHandoffTicket,
} from './jumia-oauth-handoff-ticket';

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

    // Atomically claim the ticket — the RPC verifies auth.uid ownership,
    // merchant permission, status, and expiry inside one transaction.
    // Finalize only after OAuth persistence succeeds so retries remain possible.
    const ticketClaimed = await claimJumiaOAuthHandoffTicket(auth.supabase, {
      merchantId,
      ticketId,
    });

    if (!ticketClaimed) {
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
      await releaseJumiaOAuthHandoffTicket(auth.supabase, {
        merchantId,
        ticketId,
      });
      return NextResponse.json(
        { error: 'OAuth not configured' },
        { status: 500 }
      );
    }

    let tokens: Awaited<ReturnType<typeof exchangeJumiaCode>>;
    try {
      const jumiaRedirectUri = getJumiaRedirectUri(appUrl);
      tokens = await exchangeJumiaCode({
        code,
        clientId: jumiaClientId,
        clientSecret: jumiaClientSecret,
        redirectUri: jumiaRedirectUri,
      });
    } catch (exchangeError) {
      console.error('[Jumia Exchange] Token exchange failed:', exchangeError);
      await releaseJumiaOAuthHandoffTicket(auth.supabase, {
        merchantId,
        ticketId,
      });
      return NextResponse.json({ error: 'Exchange failed' }, { status: 500 });
    }

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
        await releaseJumiaOAuthHandoffTicket(auth.supabase, {
          merchantId,
          ticketId,
        });
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
    const integrationRows = buildJumiaOAuthIntegrationRows({
      merchantId,
      shops: discoveredShops,
      tokens,
      tokenExpiresAt,
      isFallbackShop,
    });

    // Upsert integrations (user-scoped, RLS-enforced)
    const { error: upsertError } = await auth.supabase
      .from('marketplace_integrations')
      .upsert(integrationRows, {
        onConflict: 'merchant_id,platform,shop_id,marketplace_key',
      });

    if (upsertError) {
      console.error('[Jumia Exchange] Upsert failed:', upsertError);
      await releaseJumiaOAuthHandoffTicket(auth.supabase, {
        merchantId,
        ticketId,
      });
      return NextResponse.json(
        { error: 'Failed to save integrations' },
        { status: 500 }
      );
    }

    const ticketFinalized = await finalizeJumiaOAuthHandoffTicket(
      auth.supabase,
      {
        merchantId,
        ticketId,
      }
    );
    if (!ticketFinalized) {
      console.error('[Jumia Exchange] Failed to finalize handoff ticket');
      // Integrations are already persisted; leave the claim so retries do not
      // re-run a successful OAuth code exchange against Jumia.
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
