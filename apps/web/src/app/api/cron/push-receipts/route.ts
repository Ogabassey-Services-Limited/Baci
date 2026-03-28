import Expo from 'expo-server-sdk';
import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function GET(request: NextRequest) {
  // Auth: verify cron secret
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  if (fetchError || !pendingTickets || pendingTickets.length === 0) {
    // Run cleanup regardless
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
          await supabase
            .from('push_notification_tickets')
            .update({
              status: 'delivered',
              checked_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);
        } else {
          failed++;
          await supabase
            .from('push_notification_tickets')
            .update({
              status: 'failed',
              error_type: receipt.details?.error ?? null,
              error_message: receipt.message ?? null,
              checked_at: new Date().toISOString(),
            })
            .eq('id', ticket.id);

          if (receipt.details?.error === 'DeviceNotRegistered') {
            tokensToDeactivate.push(ticket.push_token);
          }
        }
      }
    } catch (error) {
      console.error('Receipt polling chunk failed:', error);
    }
  }

  // Deactivate invalid tokens
  if (tokensToDeactivate.length > 0) {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('token', tokensToDeactivate);
  }

  // Cleanup old tickets
  await supabase.rpc('cleanup_old_push_tickets');

  return NextResponse.json({
    checked: pendingTickets.length,
    delivered,
    failed,
  });
}
