import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Persists wallet/savings redemptions onto the order row at checkout time.
 *
 * Payment webhooks anchor their expected gateway amount to
 * `total − max(amount_paid, wallet_amount_used)`; the redemption RPCs only
 * write ledger rows, so without this order-row write those columns stay 0
 * and a legitimate residual payout (customer paid part of the order with
 * wallet/savings) is rejected as an amount mismatch.
 *
 * Uses the admin client because it runs server-side inside order creation
 * with a route-generated order id (matching the route's existing admin
 * usage), but stays blast-radius-bounded: amounts are clamped to the order
 * total and the update only applies while the order is still in a
 * pre-payment state with no recorded payment.
 *
 * Best-effort by design: a failure here must not fail order creation — it
 * falls back to the webhook's fail-closed mismatch handling.
 */
export async function recordPreGatewayRedemption(
  orderId: string,
  orderTotal: number,
  savingsAmountUsed: number,
  walletAmountUsed: number
): Promise<void> {
  const total = Math.max(Number(orderTotal) || 0, 0);
  const savings = Math.max(Number(savingsAmountUsed) || 0, 0);
  const wallet = Math.min(Math.max(Number(walletAmountUsed) || 0, 0), total);
  const totalRedeemed = Math.min(savings + wallet, total);
  if (totalRedeemed <= 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('orders')
    .update({
      amount_paid: totalRedeemed,
      ...(wallet > 0 && { wallet_amount_used: wallet }),
    })
    .eq('id', orderId)
    .in('payment_status', ['unpaid', 'pending'])
    .eq('amount_paid', 0);

  if (error) {
    logger.error({
      message: 'Failed to record pre-gateway redemption on order',
      orderId,
      savingsAmountUsed: savings,
      walletAmountUsed: wallet,
      error,
    });
  }
}
