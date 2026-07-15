import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';
import { restorePrepaidTender } from '@/lib/payments/refund-paypal-prepaid';
import { resolvePaypalSplit } from '@/lib/payments/resolve-paypal-split';

/**
 * The single mixed-tender PayPal refund splitter (see
 * docs/payments/paypal-capture-reconciliation-design.md §4c). Replaces the
 * PayPal branch of `order-cancellation-refund.ts`, which refunded only the
 * PayPal residual yet reported the full `amount_paid` refunded and left the
 * wallet/savings prepaid tender consumed (F-74).
 *
 * It reads the `paypal_split` persisted at finalize (fallback: recompute from
 * order total + wallet_amount_used + savings), refunds the PayPal residual leg,
 * restores the prepaid leg to the customer wallet, records a per-channel audit
 * row for each leg, and reports the true split.
 */
export interface PaypalRefundSplitResult {
  success: boolean;
  paypalRefunded: number;
  prepaidRestored: number;
  totalRefunded: number;
  paypalRefundIds: string[];
  pendingRefundIds?: string[];
  refundPending?: boolean;
  walletCreditId?: string;
  savingsRestored: boolean;
  error?: string;
}

async function recordRefundAuditRow(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    orderNumber?: string | null;
    currency: string;
    gateway: 'paypal' | 'wallet';
    amount: number;
    reference: string | undefined;
  }
): Promise<void> {
  const { error } = await supabase.from('transactions').insert({
    merchant_id: input.merchantId,
    order_id: input.orderId,
    transaction_type: 'refund',
    amount: input.amount,
    currency: input.currency,
    status: 'completed',
    gateway: input.gateway,
    gateway_reference: input.reference ?? null,
    description: `Refund (${input.gateway}) for cancelled order #${
      input.orderNumber || input.orderId.slice(0, 8)
    }`,
  });
  if (error) {
    logger.error({
      message: 'PayPal refund: failed to record per-channel refund audit row',
      error,
      orderId: input.orderId,
      gateway: input.gateway,
    });
  }
}

export async function refundPaypalOrder(input: {
  supabase: SupabaseClient;
  merchantId: string;
  order: {
    id: string;
    order_number?: string | null;
    currency?: string | null;
  };
  transaction: { gateway_response: unknown; metadata?: unknown };
  reason: string;
}): Promise<PaypalRefundSplitResult> {
  const { supabase, merchantId, order, transaction, reason } = input;
  const currency = order.currency || 'NGN';

  const resolvedSplit = await resolvePaypalSplit(
    supabase,
    merchantId,
    order.id,
    transaction.metadata
  );

  if ('failed' in resolvedSplit) {
    // We do not know how the order was actually paid, so we cannot know what to
    // give back. Refund NOTHING rather than the wrong amount — the money is still
    // safely at PayPal and the cancellation can be retried once the DB recovers.
    logger.error({
      message:
        'PayPal refund aborted: could not resolve the wallet/savings/PayPal split',
      merchantId,
      orderId: order.id,
      reason: resolvedSplit.reason,
    });
    return {
      success: false,
      error:
        'Could not determine how this order was paid; no refund was issued. Please retry.',
      paypalRefunded: 0,
      prepaidRestored: 0,
      totalRefunded: 0,
      paypalRefundIds: [],
      savingsRestored: false,
    };
  }

  const split = resolvedSplit;

  // 1. PayPal residual leg — full refund per capture, presentment currency.
  const paypalRefund = await initiatePaypalOrderRefund({
    merchantId,
    gatewayResponse: transaction.gateway_response,
    reason,
  });
  const paypalRefundIds = paypalRefund.refundIds ?? [];
  const paypalRefunded = paypalRefund.success ? split.paypalResidualPaid : 0;

  if (paypalRefunded > 0) {
    await recordRefundAuditRow(supabase, {
      merchantId,
      orderId: order.id,
      orderNumber: order.order_number,
      currency,
      gateway: 'paypal',
      amount: paypalRefunded,
      reference: paypalRefundIds[0],
    });
  }

  // 2. Prepaid leg — restore wallet + redeemed savings.
  const prepaid = await restorePrepaidTender(supabase, {
    merchantId,
    orderId: order.id,
    orderNumber: order.order_number,
    customerId: split.customerId,
    prepaidPaid: split.prepaidPaid,
    savingsAmountUsed: split.savingsAmountUsed,
    reason,
  });

  if (prepaid.restored > 0) {
    await recordRefundAuditRow(supabase, {
      merchantId,
      orderId: order.id,
      orderNumber: order.order_number,
      currency,
      gateway: 'wallet',
      amount: prepaid.restored,
      reference: prepaid.walletCreditId,
    });
  }

  const totalRefunded = paypalRefunded + prepaid.restored;
  const prepaidComplete =
    split.prepaidPaid <= 0 ||
    (prepaid.restored >= split.prepaidPaid && prepaid.savingsRestored);
  const success = paypalRefund.success && prepaidComplete;
  // This flag describes the PayPal leg, independently of the prepaid leg. Once
  // PayPal accepts an asynchronous refund, callers must terminalize the capture
  // as refund_pending even when wallet/savings restoration still needs a retry;
  // otherwise a cancellation retry can submit the same PayPal refund again.
  const refundPending = paypalRefund.pending === true;

  const errorParts: string[] = [];
  if (!paypalRefund.success) {
    errorParts.push(paypalRefund.error ?? 'PayPal refund failed');
  }
  if (!prepaidComplete) {
    errorParts.push('Prepaid tender could not be fully restored');
  }

  return {
    success,
    paypalRefunded,
    prepaidRestored: prepaid.restored,
    totalRefunded,
    paypalRefundIds,
    pendingRefundIds: paypalRefund.pendingRefundIds,
    refundPending,
    walletCreditId: prepaid.walletCreditId,
    savingsRestored: prepaid.savingsRestored,
    error: errorParts.length > 0 ? errorParts.join('; ') : undefined,
  };
}
