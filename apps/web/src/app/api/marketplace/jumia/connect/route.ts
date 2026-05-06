/**
 * Jumia Connect API Route
 * Initiates OAuth flow to connect merchant's Jumia account
 */

import crypto from 'node:crypto';
import { createJumiaMobileReturnUrl } from '@baci/shared';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getConfiguredAppUrl, getJumiaClientId } from '@/env';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getJumiaAuthUrl, getJumiaRedirectUri } from '@/lib/jumia/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { deleteJumiaConnectionQuerySchema } from '@/schemas/marketplace';

const _jumiaConnectSchema = z.discriminatedUnion('connectionType', [
  z.object({
    connectionType: z.literal('self_authorization'),
    refreshToken: z.string().min(1, 'Refresh token is required'),
    shopId: z.string().optional(),
    shopName: z.string().optional(),
    countryCode: z.string().length(2).optional(),
  }),
  z.object({
    connectionType: z.literal('oauth'),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    // CSRF validation
    const csrf = await checkCsrfProtection(request);
    if (!csrf.valid) {
      return (
        csrf.response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('connectionType');

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      if (
        connectionType === 'oauth' &&
        searchParams.get('platform') === 'mobile'
      ) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for this user
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const rawBody = await request.json();
    const parsed = _jumiaConnectSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Check connection type
    if (body.connectionType === 'self_authorization') {
      // Self Authorization: Merchant provides their refresh token directly
      // This is for machine-to-machine connections
      const { refreshToken, shopId, shopName, countryCode } = body;

      // Store the integration with refresh token
      const { data: integration, error: insertError } = await supabase
        .from('marketplace_integrations')
        .upsert(
          {
            merchant_id: merchantId,
            platform: 'jumia',
            shop_id: shopId || 'default',
            shop_name: shopName || 'My Jumia Shop',
            country_code: countryCode || 'NG',
            refresh_token: refreshToken,
            is_active: true,
            sync_config: { products: true, orders: true, stock: true },
          },
          {
            onConflict: 'merchant_id,platform,shop_id',
          }
        )
        .select('id, shop_id, shop_name')
        .single();

      if (insertError) {
        console.error('[Jumia Connect] Database error:', insertError);
        return NextResponse.json(
          { error: 'Failed to save integration' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Jumia account connected successfully',
        integration: {
          id: integration.id,
          shopId: integration.shop_id,
          shopName: integration.shop_name,
        },
      });
    } else {
      // OAuth flow: Redirect to Jumia authorization
      const jumiaClientId = getJumiaClientId();
      const appUrl = getConfiguredAppUrl();
      if (!jumiaClientId || !appUrl) {
        return NextResponse.json(
          { error: 'Jumia OAuth not configured' },
          { status: 500 }
        );
      }
      const jumiaRedirectUri = getJumiaRedirectUri(appUrl);

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      // Store state in cookie for verification on callback
      const response = NextResponse.json({
        success: true,
        redirectUrl: getJumiaAuthUrl({
          clientId: jumiaClientId,
          redirectUri: jumiaRedirectUri,
          state,
        }),
      });

      response.cookies.set('jumia_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      response.cookies.set('jumia_merchant_id', merchantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      return response;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    console.error('[Jumia Connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET: Check current Jumia connection status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('connectionType');
    const hasBearerAuth = request.headers
      .get('Authorization')
      ?.startsWith('Bearer ');

    // --- Mobile ticket flow (runs before cookie auth) ---
    const ticket = searchParams.get('ticket');
    if (
      ticket &&
      connectionType === 'oauth' &&
      searchParams.get('platform') === 'mobile'
    ) {
      const ticketParsed = z.string().uuid().safeParse(ticket);
      if (!ticketParsed.success) {
        return NextResponse.redirect(
          createJumiaMobileReturnUrl({ error: 'invalid_ticket' })
        );
      }

      // Check OAuth config BEFORE consuming the ticket so we never
      // waste a one-time ticket when configuration is missing.
      const jumiaClientId = getJumiaClientId();
      const appUrl = getConfiguredAppUrl();
      if (!jumiaClientId || !appUrl) {
        return NextResponse.redirect(
          createJumiaMobileReturnUrl({ error: 'oauth_not_configured' })
        );
      }

      // Generate state up-front so we can bind it atomically with redemption
      const state = crypto.randomBytes(16).toString('hex');

      // Atomically redeem the ticket AND bind the OAuth state in a single UPDATE
      const adminClient = createAdminClient();
      const { data: ticketData, error: ticketError } = await adminClient
        .from('oauth_handoff_tickets')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          oauth_state: state,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', ticketParsed.data)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .select('merchant_id')
        .single();

      if (ticketError || !ticketData) {
        return NextResponse.redirect(
          createJumiaMobileReturnUrl({ error: 'ticket_invalid' })
        );
      }

      const redirectUrl = getJumiaAuthUrl({
        clientId: jumiaClientId,
        redirectUri: getJumiaRedirectUri(appUrl),
        state,
      });

      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set('jumia_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });
      response.cookies.set('jumia_merchant_id', ticketData.merchant_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });
      response.cookies.set('jumia_oauth_platform', 'mobile', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });
      response.cookies.set('jumia_ticket_id', ticketParsed.data, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      return response;
    }

    // --- Shared cookie/bearer auth flow ---
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      if (
        connectionType === 'oauth' &&
        searchParams.get('platform') === 'mobile' &&
        !hasBearerAuth
      ) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', request.url);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for this user
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Handle OAuth Redirect Flow
    if (connectionType === 'oauth') {
      const jumiaClientId = getJumiaClientId();
      const appUrl = getConfiguredAppUrl();
      if (!jumiaClientId || !appUrl) {
        return NextResponse.json(
          { error: 'Jumia OAuth not configured' },
          { status: 500 }
        );
      }
      const jumiaRedirectUri = getJumiaRedirectUri(appUrl);

      const platform = searchParams.get('platform'); // 'mobile' or undefined

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      const redirectUrl = getJumiaAuthUrl({
        clientId: jumiaClientId,
        redirectUri: jumiaRedirectUri,
        state,
      });

      // return redirect to Jumia
      const response = NextResponse.redirect(redirectUrl);

      // Set cookies for security and context
      response.cookies.set('jumia_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      response.cookies.set('jumia_merchant_id', merchantId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      if (platform) {
        response.cookies.set('jumia_oauth_platform', platform, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 10, // 10 minutes
        });
      }

      return response;
    }

    // Default: Check connection status
    const { data: integrations, error: integrationsError } = await auth.supabase
      .from('marketplace_integrations')
      .select(
        'id, shop_id, shop_name, country_code, is_active, last_sync_at, sync_error'
      )
      .eq('merchant_id', merchantId)
      .eq('platform', 'jumia')
      .eq('is_active', true);

    if (integrationsError) {
      console.error(
        '[Jumia Connect] Failed to fetch connection status:',
        integrationsError
      );
      return NextResponse.json(
        {
          error:
            integrationsError.message || 'Failed to fetch connection status',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: integrations && integrations.length > 0,
      integrations: integrations || [],
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    console.error('[Jumia Connect] Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Disconnect Jumia account
 */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF validation
    const csrf = await checkCsrfProtection(request);
    if (!csrf.valid) {
      return (
        csrf.response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant for this user (prevents IDOR)
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const deleteAccess = toUserAccess(merchantContext);
    if (!hasPermission(deleteAccess, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = deleteJumiaConnectionQuerySchema.safeParse({
      id: searchParams.get('id'),
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }
    const { id: integrationId } = parsedQuery.data;

    // Deactivate the integration scoped to merchant (soft delete for audit trail)
    const { data: updated, error: updateError } = await auth.supabase
      .from('marketplace_integrations')
      .update({ is_active: false })
      .eq('id', integrationId)
      .eq('merchant_id', merchantContext.merchantId)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('[Jumia Disconnect] Error:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Jumia account disconnected',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('prerendering') ||
        error.message.includes('dynamic server usage'))
    ) {
      throw error;
    }
    console.error('[Jumia Disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
