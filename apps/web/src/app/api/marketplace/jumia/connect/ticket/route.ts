import { type NextRequest, NextResponse } from 'next/server';
import { getConfiguredAppUrl } from '@/env';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  getMerchantFeatureAccess,
  merchantFeatureUpgradeResponse,
} from '@/lib/merchant-feature-gates';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST: Create a short-lived OAuth handoff ticket for mobile Jumia connection.
 *
 * The mobile app calls this with Bearer auth, receives a ticket + authUrl,
 * then opens the authUrl in a system browser. The browser redeems the ticket
 * to prove identity without needing Supabase session cookies.
 */
export async function POST(request: NextRequest) {
  try {
    // No CSRF check required — this endpoint uses Bearer token auth (mobile app),
    // not cookie-based auth. CSRF attacks only exploit automatic cookie inclusion.
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const featureAccess = await getMerchantFeatureAccess(
      auth.supabase,
      access.merchantId,
      'marketplace_sync'
    );
    if (featureAccess.error) {
      console.error(
        '[Jumia Ticket] Feature access lookup failed:',
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

    const appUrl = getConfiguredAppUrl();
    if (!appUrl) {
      return NextResponse.json(
        { error: 'App URL not configured' },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const { data: ticket, error: insertError } = await adminClient
      .from('oauth_handoff_tickets')
      .insert({
        merchant_id: access.merchantId,
        user_id: auth.user.id,
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single();

    if (insertError || !ticket) {
      console.error('[Jumia Ticket] Insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      );
    }

    const baseUrl = appUrl.replace(/\/+$/, '');
    const authUrl = `${baseUrl}/api/marketplace/jumia/connect?connectionType=oauth&ticket=${encodeURIComponent(ticket.id)}&platform=mobile`;

    return NextResponse.json({ ticket: ticket.id, authUrl });
  } catch (error) {
    console.error('[Jumia Ticket] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
