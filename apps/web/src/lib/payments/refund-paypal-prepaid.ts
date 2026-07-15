import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Restores the prepaid tender (wallet credit + redeemed savings) of a
 * mixed-tender PayPal order on cancellation (see
 * docs/payments/paypal-capture-reconciliation-design.md §4c step 3). The PayPal
 * leg refunds the gateway residual; this leg makes the customer whole for the
 * Baci-side tender that PayPal never held, so the refund is exact instead of
 * refunding only the PayPal residual while wallet/savings stays consumed (F-74).
 *
 * The full prepaid amount is returned to the customer wallet via
 * `credit_customer_wallet`, then a service-only atomic RPC stamps the savings
 * redemption row reversed for audit. Idempotent by order: a prior wallet-refund
 * audit row short-circuits a second credit.
 */
export interface PrepaidRestoreResult {
  restored: number;
  walletCreditId?: string;
  savingsRestored: boolean;
}

export async function restorePrepaidTender(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    orderNumber?: string | null;
    customerId: string | null;
    prepaidPaid: number;
    savingsAmountUsed: number;
    reason: string;
  }
): Promise<PrepaidRestoreResult> {
  const { merchantId, orderId, customerId, prepaidPaid, savingsAmountUsed } =
    input;

  if (!(prepaidPaid > 0)) {
    return { restored: 0, savingsRestored: true };
  }

  if (!customerId) {
    logger.error({
      message:
        'PayPal refund: prepaid tender present but order has no customer to credit',
      orderId,
      merchantId,
    });
    return { restored: 0, savingsRestored: false };
  }

  // Idempotency: a prior wallet-refund audit row means the credit already ran.
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('transaction_type', 'refund')
    .eq('gateway', 'wallet')
    .limit(1)
    .maybeSingle();
  if (existing) {
    const savingsRestored = await restoreSavingsAudit(
      supabase,
      merchantId,
      orderId,
      savingsAmountUsed,
      input.reason
    );
    return {
      restored: prepaidPaid,
      walletCreditId: existing.id as string,
      savingsRestored,
    };
  }

  const { data: creditRows, error: creditError } = await supabase.rpc(
    'credit_customer_wallet',
    {
      p_customer_id: customerId,
      p_merchant_id: merchantId,
      p_amount: prepaidPaid,
      // `order_refund` maps to a `refund` wallet-transaction type in
      // credit_customer_wallet. The previous 'order' was rejected 22023
      // (unsupported source type) before any credit, so the prepaid leg of a
      // cancelled mixed-tender PayPal order was never refunded. Idempotent per
      // order via source_id=orderId (advisory lock + dedupe inside the RPC).
      p_source_type: 'order_refund',
      p_source_id: orderId,
      p_description: `Prepaid refund for cancelled order ${
        input.orderNumber || orderId.slice(0, 8)
      }`,
    }
  );

  if (creditError) {
    logger.error({
      message:
        'PayPal refund: failed to credit customer wallet for prepaid leg',
      error: creditError,
      orderId,
      merchantId,
    });
    return { restored: 0, savingsRestored: false };
  }

  const credit = Array.isArray(creditRows) ? creditRows[0] : creditRows;
  const walletCreditId =
    credit && typeof credit === 'object' && 'transaction_id' in credit
      ? (credit as { transaction_id?: string }).transaction_id
      : undefined;

  const savingsRestored = await restoreSavingsAudit(
    supabase,
    merchantId,
    orderId,
    savingsAmountUsed,
    input.reason
  );

  return { restored: prepaidPaid, walletCreditId, savingsRestored };
}

async function restoreSavingsAudit(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  savingsAmountUsed: number,
  reason: string
): Promise<boolean> {
  if (savingsAmountUsed <= 0) {
    return true;
  }
  return await markSavingsRedemptionsReversed(
    supabase,
    merchantId,
    orderId,
    reason
  );
}

/**
 * Atomically stamps the order's savings redemption row reversed. Concurrent
 * retries can update only an unreversed row, so the first audit time/reason is
 * preserved. Best-effort — the money was already returned to the wallet above.
 */
async function markSavingsRedemptionsReversed(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase.rpc(
    'mark_customer_savings_redemptions_reversed',
    {
      p_merchant_id: merchantId,
      p_order_id: orderId,
      p_reason: reason,
    }
  );

  if (error) {
    logger.error({
      message: 'PayPal refund: failed to mark savings redemption reversed',
      error,
      orderId,
    });
    return false;
  }
  return true;
}
