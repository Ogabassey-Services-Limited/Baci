import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { runPaypalReconcileFunnel } from '@/lib/payments/paypal-settlement-funnel';

/**
 * The create-order double-charge guards (the completed-txn guard and the
 * `already_captured` reuse branch) reconcile a PayPal order that ALREADY captured
 * money, so the route can block the retry without stranding the charge.
 *
 * This used to re-implement validate → flip → settle on its own, which is exactly
 * how it drifted from the capture route: it never checked residual freshness (so
 * it could settle an order for a NEW total against a capture of the OLD amount),
 * and it settled anyway after a failed transaction write (leaving the refund path
 * with no capture IDs). It now delegates to the single settlement funnel, so it
 * inherits every guard the capture route has — settler verdict, residual
 * freshness, cancellation clamp, post-capture refunds — and cannot drift again.
 *
 * The funnel runs `reconcile_only`: this path must NEVER charge. If the order is
 * still capturable (PayPal took nothing), the funnel says so instead of charging.
 */
export async function reconcileCompletedPaypalOrderForCreate(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    paypalOrderId: string;
  }
): Promise<void> {
  const { merchantId, orderId, paypalOrderId } = input;

  const result = await runPaypalReconcileFunnel(supabase, {
    merchantId,
    orderId,
    paypalOrderId,
  });

  if (!result.ok) {
    logger.warn({
      message:
        'PayPal create-order reconcile: could not run the settlement funnel',
      orderId,
      paypalOrderId,
      status: result.status,
      body: result.body,
    });
    return;
  }

  // The funnel owns the outcome (settle / block+refund / reject+refund / clamp).
  // The route only needs to block the retry afterwards, so there is nothing to
  // return — but a non-2xx is worth surfacing.
  if (!result.response.ok) {
    logger.warn({
      message:
        'PayPal create-order reconcile: funnel did not settle the captured order',
      orderId,
      paypalOrderId,
      status: result.response.status,
    });
  }
}
