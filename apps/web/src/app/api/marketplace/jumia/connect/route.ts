/**
 * Jumia Connect API Route
 * Initiates OAuth flow to connect merchant's Jumia account
 */

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getJumiaAuthUrl } from '@/lib/jumia/client';
import { createClient } from '@/lib/supabase/server';

// For Self Authorization flow, only refresh token is needed
// For OAuth flow, you'll need client_id/secret from Jumia partner dashboard
const JUMIA_CLIENT_ID = process.env.JUMIA_CLIENT_ID;
const JUMIA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/marketplace/jumia/callback`;

export async function POST(request: NextRequest) {
  try {
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
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Check connection type
    if (body.connectionType === 'self_authorization') {
      // Self Authorization: Merchant provides their refresh token directly
      // This is for machine-to-machine connections
      const { refreshToken, shopId, shopName, countryCode } = body;

      if (!refreshToken) {
        return NextResponse.json(
          { error: 'Refresh token is required for self authorization' },
          { status: 400 }
        );
      }

      // Store the integration with refresh token
      const { data: integration, error: insertError } = await supabase
        .from('marketplace_integrations')
        .upsert(
          {
            merchant_id: merchant.id,
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
        .select()
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
      if (!JUMIA_CLIENT_ID) {
        return NextResponse.json(
          { error: 'Jumia OAuth not configured' },
          { status: 500 }
        );
      }

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      // Store state in cookie for verification on callback
      const response = NextResponse.json({
        success: true,
        redirectUrl: getJumiaAuthUrl({
          clientId: JUMIA_CLIENT_ID,
          redirectUri: JUMIA_REDIRECT_URI,
          state,
        }),
      });

      response.cookies.set('jumia_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
      });

      response.cookies.set('jumia_merchant_id', merchant.id, {
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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { searchParams } = new URL(request.url);
    const connectionType = searchParams.get('connectionType');

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
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Handle OAuth Redirect Flow
    if (connectionType === 'oauth') {
      if (!JUMIA_CLIENT_ID) {
        return NextResponse.json(
          { error: 'Jumia OAuth not configured' },
          { status: 500 }
        );
      }

      const platform = searchParams.get('platform'); // 'mobile' or undefined

      // Generate state for CSRF protection
      const state = crypto.randomBytes(16).toString('hex');

      const redirectUrl = getJumiaAuthUrl({
        clientId: JUMIA_CLIENT_ID,
        redirectUri: JUMIA_REDIRECT_URI,
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

      response.cookies.set('jumia_merchant_id', merchant.id, {
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
    const { data: integrations } = await supabase
      .from('marketplace_integrations')
      .select(
        'id, shop_id, shop_name, country_code, is_active, last_sync_at, sync_error'
      )
      .eq('merchant_id', merchant.id)
      .eq('platform', 'jumia')
      .eq('is_active', true);

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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('id');

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID required' },
        { status: 400 }
      );
    }

    // Deactivate the integration (soft delete for audit trail)
    const { error: updateError } = await supabase
      .from('marketplace_integrations')
      .update({ is_active: false })
      .eq('id', integrationId);

    if (updateError) {
      console.error('[Jumia Disconnect] Error:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
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
