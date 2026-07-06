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
 * Best-effort by design: a failure here must not fail order creation — it
 * falls back to the webhook's fail-closed mismatch handling.
 */
export async function recordPreGatewayRedemption(
  orderId: string,
  savingsAmountUsed: number,
  walletAmountUsed: number
): Promise<void> {
  const savings = Number(savingsAmountUsed) || 0;
  const wallet = Number(walletAmountUsed) || 0;
  const totalRedeemed = savings + wallet;
  if (totalRedeemed <= 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('orders')
    .update({
      amount_paid: totalRedeemed,
      ...(wallet > 0 && { wallet_amount_used: wallet }),
    })
    .eq('id', orderId);

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
