import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';
import { restorePrepaidTender } from '@/lib/payments/refund-paypal-prepaid';

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
  walletCreditId?: string;
  savingsRestored: boolean;
  error?: string;
}

interface ResolvedSplit {
  paypalResidualPaid: number;
  prepaidPaid: number;
  savingsAmountUsed: number;
  customerId: string | null;
}

function finiteOrNull(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

async function resolvePaypalSplit(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  txnMetadata: unknown
): Promise<ResolvedSplit | { failed: true; reason: string }> {
  // FAIL CLOSED on both reads. These errors used to be dropped
  // (`const { data } = await ...`), which made a transient DB failure
  // indistinguishable from a legitimate empty result — and the two have opposite
  // meanings for money:
  //
  //   • savings lookup fails → savingsAmountUsed silently becomes 0 → the customer
  //     is under-credited to their wallet by EXACTLY their savings, the redemption
  //     rows are never reversed, and the refund still reports success.
  //   • order lookup fails → orderTotal becomes 0 → the computed split is 0/0 and
  //     NOTHING is refunded, also reported as success.
  //
  // A refund that quietly returns the wrong amount is worse than one that fails
  // loudly, so the caller aborts and the order stays refundable.
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('total, wallet_amount_used, customer_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (orderError || !orderRow) {
    return { failed: true, reason: 'order_lookup_failed' };
  }

  const orderTotal = Number(orderRow?.total) || 0;
  const walletAmountUsed = Math.max(
    Number(orderRow?.wallet_amount_used) || 0,
    0
  );
  const customerId = (orderRow?.customer_id as string | null) ?? null;

  const { data: savingsRows, error: savingsError } = await supabase
    .from('customer_savings_redemptions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId);

  if (savingsError) {
    return { failed: true, reason: 'savings_lookup_failed' };
  }

  const savingsAmountUsed = Array.isArray(savingsRows)
    ? savingsRows.reduce(
        (sum, row) => sum + (Math.max(Number(row?.amount) || 0, 0) || 0),
        0
      )
    : 0;

  const metadata = (txnMetadata as Record<string, unknown> | null) ?? {};
  const storedSplit = metadata.paypal_split as
    | { paypalResidualPaid?: unknown; prepaidPaid?: unknown }
    | undefined;
  const storedResidual = finiteOrNull(storedSplit?.paypalResidualPaid);
  const storedPrepaid = finiteOrNull(storedSplit?.prepaidPaid);

  if (storedResidual !== null && storedPrepaid !== null) {
    return {
      paypalResidualPaid: storedResidual,
      prepaidPaid: storedPrepaid,
      savingsAmountUsed,
      customerId,
    };
  }

  // Fallback for orders finalized before paypal_split existed.
  const prepaidPaid = walletAmountUsed + savingsAmountUsed;
  return {
    paypalResidualPaid: Math.max(orderTotal - prepaidPaid, 0),
    prepaidPaid,
    savingsAmountUsed,
    customerId,
  };
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
    walletCreditId: prepaid.walletCreditId,
    savingsRestored: prepaid.savingsRestored,
    error: errorParts.length > 0 ? errorParts.join('; ') : undefined,
  };
}
