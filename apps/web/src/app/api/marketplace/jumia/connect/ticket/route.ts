import { type NextRequest, NextResponse } from 'next/server';
import { getConfiguredAppUrl } from '@/env';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
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
