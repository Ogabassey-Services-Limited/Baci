import { Expo } from 'expo-server-sdk';
import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function GET(request: NextRequest) {
  // Auth: fail-closed when CRON_SECRET is not configured
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch pending tickets older than 15 minutes (Expo needs time to process)
  const { data: pendingTickets, error: fetchError } = await supabase
    .from('push_notification_tickets')
    .select('id, ticket_id, push_token')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(1000);

  if (fetchError) {
    logger.error({
      message: 'Failed to fetch pending push tickets',
      error: fetchError,
    });
    return NextResponse.json({ error: 'Database read error' }, { status: 500 });
  }

  if (!pendingTickets || pendingTickets.length === 0) {
    // Still run cleanup on empty results — this is the only invocation per cron run
    await supabase.rpc('cleanup_old_push_tickets');
    return NextResponse.json({ checked: 0, cleaned: true });
  }

  // Build O(1) lookup map instead of O(n) .find() per receipt
  const ticketMap = new Map(pendingTickets.map((t) => [t.ticket_id, t]));

  const receiptIds = pendingTickets.map((t) => t.ticket_id);
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  const deliveredIds: string[] = [];
  const failedTickets: Array<{
    id: string;
    error_type: string | null;
    error_message: string | null;
  }> = [];
  const tokensToDeactivate: string[] = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const ticket = ticketMap.get(receiptId);
        if (!ticket) continue;

        if (receipt.status === 'ok') {
          deliveredIds.push(ticket.id);
        } else {
          failedTickets.push({
            id: ticket.id,
            error_type: receipt.details?.error ?? null,
            error_message: receipt.message ?? null,
          });

          if (
            receipt.details?.error === 'DeviceNotRegistered' &&
            ticket.push_token
          ) {
            tokensToDeactivate.push(ticket.push_token);
          }
        }
      }
    } catch (error) {
      logger.error({ message: 'Receipt polling chunk failed', error });
    }
  }

  // Batch update delivered tickets
  if (deliveredIds.length > 0) {
    const { error: deliveredError } = await supabase
      .from('push_notification_tickets')
      .update({
        status: 'delivered',
        checked_at: new Date().toISOString(),
      })
      .in('id', deliveredIds);
    if (deliveredError) {
      logger.error({
        message: 'Failed to batch-update delivered tickets',
        error: deliveredError,
      });
    }
  }

  // Update failed tickets individually (each may have different error details)
  for (const ft of failedTickets) {
    const { error: failedError } = await supabase
      .from('push_notification_tickets')
      .update({
        status: 'failed',
        error_type: ft.error_type,
        error_message: ft.error_message,
        checked_at: new Date().toISOString(),
      })
      .eq('id', ft.id);
    if (failedError) {
      logger.error({
        message: 'Failed to update ticket as failed',
        ticketId: ft.id,
        error: failedError,
      });
    }
  }

  // Deactivate invalid tokens
  if (tokensToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('token', tokensToDeactivate);
    if (deactivateError) {
      logger.error({
        message: 'Failed to deactivate tokens',
        error: deactivateError,
      });
    }
  }

  // Cleanup old tickets
  await supabase.rpc('cleanup_old_push_tickets');

  return NextResponse.json({
    checked: pendingTickets.length,
    delivered: deliveredIds.length,
    failed: failedTickets.length,
  });
}
