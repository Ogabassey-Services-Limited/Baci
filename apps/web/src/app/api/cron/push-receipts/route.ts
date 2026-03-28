import { Expo } from 'expo-server-sdk';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function GET(request: NextRequest) {
  // Auth: fail-closed when CRON_SECRET is not configured
  const cronSecret = process.env.CRON_SECRET;
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
    await supabase.rpc('cleanup_old_push_tickets');
    return NextResponse.json({ error: 'Database read error' }, { status: 500 });
  }

  if (!pendingTickets || pendingTickets.length === 0) {
    await supabase.rpc('cleanup_old_push_tickets');
    return NextResponse.json({ checked: 0, cleaned: true });
  }

  const receiptIds = pendingTickets.map((t) => t.ticket_id);
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  let delivered = 0;
  let failed = 0;
  const tokensToDeactivate: string[] = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        const ticket = pendingTickets.find((t) => t.ticket_id === receiptId);
        if (!ticket) continue;

        if (receipt.status === 'ok') {
          delivered++;
          const { error: updateError } = await supabase
            .from('push_notification_tickets')
            .update({
              status: 'delivered',
              checked_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);
          if (updateError) {
            logger.error({
              message: 'Failed to update ticket as delivered',
              ticketId: ticket.id,
              error: updateError,
            });
          }
        } else {
          failed++;
          const { error: updateError } = await supabase
            .from('push_notification_tickets')
            .update({
              status: 'failed',
              error_type: receipt.details?.error ?? null,
              error_message: receipt.message ?? null,
              checked_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);
          if (updateError) {
            logger.error({
              message: 'Failed to update ticket as failed',
              ticketId: ticket.id,
              error: updateError,
            });
          }

          if (receipt.details?.error === 'DeviceNotRegistered') {
            tokensToDeactivate.push(ticket.push_token);
          }
        }
      }
    } catch (error) {
      logger.error({ message: 'Receipt polling chunk failed', error });
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
    delivered,
    failed,
  });
}
