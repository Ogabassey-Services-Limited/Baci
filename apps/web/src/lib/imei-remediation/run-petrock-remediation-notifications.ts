import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { notifyPetrockRemediationTerminal } from './petrock-remediation-notifications';

export async function runPetrockRemediationNotifications({
  limit = 25,
  supabaseAdmin,
}: {
  limit?: number;
  supabaseAdmin: ReturnType<typeof createAdminClient>;
}) {
  const { data, error } = await supabaseAdmin
    .from('petrock_orders')
    .select('id, status, email_notified_at, push_notified_at')
    .in('status', ['completed', 'failed', 'refunded', 'cancelled'])
    .or('email_notified_at.is.null,push_notified_at.is.null')
    .order('updated_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;

  const orders = data ?? [];
  const summary = { claimed: orders.length, errored: 0, processed: 0 };
  for (const order of orders) {
    try {
      await notifyPetrockRemediationTerminal({
        orderId: String(order.id),
        supabaseAdmin,
      });
      summary.processed += 1;
    } catch (notificationError) {
      summary.errored += 1;
      console.error('[Petrock Remediation] Notification processing failed', {
        error: notificationError,
        orderId: order.id,
      });
    }
  }
  return summary;
}
