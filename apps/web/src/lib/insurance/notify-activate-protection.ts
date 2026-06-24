import { notifyActivateProtection } from '@/lib/expo-push';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Send the one-time "Activate Protection" push for an order that has just been
 * delivered, when it carries gadget cover whose pre-loss inspection is still
 * pending.
 *
 * Safe to call from every delivery transition point (carrier webhook, merchant
 * manual update, customer tracking sync): the reminder is claimed atomically
 * via `activation_reminder_sent_at`, so it is sent at most once per policy even
 * if delivery is reported more than once.
 */
export async function maybeNotifyActivateProtection(
  orderId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Inspectable policies still awaiting activation that we haven't nudged yet.
  const { data: policies } = await supabase
    .from('order_insurance_policies')
    .select('id')
    .eq('order_id', orderId)
    .eq('inspection_status', 'pending')
    .not('inspection_link', 'is', null)
    .is('activation_reminder_sent_at', null);

  if (!policies || policies.length === 0) return;

  const { data: order } = await supabase
    .from('orders')
    .select('order_number, customer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order?.customer_id) return;

  const { data: customer } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', order.customer_id)
    .maybeSingle();

  // Guests without an app account can't receive a push; MyCover still emails
  // them the activation link, so we leave the reminder unclaimed.
  if (!customer?.user_id) return;

  // Claim each candidate atomically; only notify if we win at least one. The
  // `is(..., null)` predicate makes concurrent deliveries race-safe.
  let claimedAny = false;
  for (const policy of policies) {
    const { data: claimed } = await supabase
      .from('order_insurance_policies')
      .update({ activation_reminder_sent_at: new Date().toISOString() })
      .eq('id', policy.id)
      .is('activation_reminder_sent_at', null)
      .select('id')
      .maybeSingle();
    if (claimed) claimedAny = true;
  }

  if (!claimedAny) return;

  await notifyActivateProtection(customer.user_id, orderId, order.order_number);
}
