import { isTerminalClaimStatusToken } from '@baci/shared/insurance';
import { notifyActivateProtection } from '@/lib/expo-push';
import { createAdminClient } from '@/lib/supabase/admin';

const DELIVERED_SHIPPING_STATUSES = new Set(['delivered', 'completed']);

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
  orderId: string,
  merchantId?: string
): Promise<void> {
  const supabase = createAdminClient();

  let orderQuery = supabase
    .from('orders')
    .select('order_number, customer_id, shipping_status')
    .eq('id', orderId);
  if (merchantId) {
    orderQuery = orderQuery.eq('merchant_id', merchantId);
  }
  const { data: order, error: orderError } = await orderQuery.maybeSingle();

  if (orderError) {
    console.error('[ActivateProtection] order lookup failed:', orderError);
    return;
  }
  if (
    !order?.customer_id ||
    !DELIVERED_SHIPPING_STATUSES.has(String(order.shipping_status))
  ) {
    return;
  }

  // Inspectable policies still awaiting activation that we haven't nudged yet.
  const { data: policies, error: policiesError } = await supabase
    .from('order_insurance_policies')
    .select('id, status, claim_status')
    .eq('order_id', orderId)
    .eq('inspection_status', 'pending')
    .not('inspection_link', 'is', null)
    .is('activation_reminder_sent_at', null);

  if (policiesError) {
    console.error('[ActivateProtection] policy lookup failed:', policiesError);
    return;
  }
  // Don't nudge "Activate Protection" for a policy whose claim already closed
  // (paid/declined/etc.) or that is no longer active — e.g. when an
  // inspection.completed webhook was missed but a claim webhook already landed.
  const eligiblePolicies = (policies ?? []).filter(
    (policy) =>
      policy.status === 'active' &&
      !isTerminalClaimStatusToken(policy.claim_status)
  );
  if (eligiblePolicies.length === 0) return;

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', order.customer_id)
    .maybeSingle();

  if (customerError) {
    console.error(
      '[ActivateProtection] customer lookup failed:',
      customerError
    );
    return;
  }
  // Guests without an app account can't receive a push; MyCover still emails
  // them the activation link, so we leave the reminder unclaimed.
  if (!customer?.user_id) return;

  // Claim each candidate atomically; only notify if we win at least one. The
  // `is(..., null)` predicate makes concurrent deliveries race-safe.
  const claimedIds: string[] = [];
  for (const policy of eligiblePolicies) {
    const { data: claimed, error: claimError } = await supabase
      .from('order_insurance_policies')
      .update({ activation_reminder_sent_at: new Date().toISOString() })
      .eq('id', policy.id)
      .is('activation_reminder_sent_at', null)
      .select('id')
      .maybeSingle();
    if (claimError) {
      console.error('[ActivateProtection] claim update failed:', claimError);
      continue;
    }
    if (claimed) claimedIds.push(policy.id);
  }

  if (claimedIds.length === 0) return;

  const releaseReminderClaims = async (message: string) => {
    const { error: releaseError } = await supabase
      .from('order_insurance_policies')
      .update({ activation_reminder_sent_at: null })
      .in('id', claimedIds);
    if (releaseError) {
      console.error(message, releaseError);
    }
  };

  let result: Awaited<ReturnType<typeof notifyActivateProtection>>;
  try {
    result = merchantId
      ? await notifyActivateProtection(
          customer.user_id,
          orderId,
          order.order_number,
          { merchantId }
        )
      : await notifyActivateProtection(
          customer.user_id,
          orderId,
          order.order_number
        );
  } catch (error) {
    console.error('[ActivateProtection] push send failed:', error);
    await releaseReminderClaims(
      '[ActivateProtection] failed to release failed reminder claim:'
    );
    return;
  }

  // If nothing was actually delivered (no token / send failure), release the
  // claim so a later delivery can retry the reminder.
  if (result.sent === 0) {
    await releaseReminderClaims(
      '[ActivateProtection] failed to release undelivered reminder claim:'
    );
  }
}
