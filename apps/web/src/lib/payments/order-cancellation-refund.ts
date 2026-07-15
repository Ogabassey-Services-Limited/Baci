import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { markPaypalTransactionRefunded } from '@/lib/payments/mark-paypal-transaction-refunded';
import { refundPaypalOrder } from '@/lib/payments/refund-paypal-order';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';

/**
 * Refund dispatch for a cancelled order's captured payment (extracted from
 * `POST /api/orders/[id]/cancelled` so the route stays under the 300-line cap
 * and the money path is independently testable). Branches on the payment
 * gateway — Paystack and PayPal (BYOK) are wired; Korapay is still a TODO.
 */

export interface OrderCancellationRefundResult {
  /** True when a payment existed to refund (mirrors the route's `amountPaid > 0`). */
  attempted: boolean;
  success: boolean;
  amount: number;
  refundId?: number | string;
  error?: string;
  /**
   * The gateway refund succeeded but writing the local `transactions` audit row
   * failed. Never a hard error — the gateway ledger is authoritative and a retry
   * would risk a double refund.
   */
  auditRecordFailed?: boolean;
}

export interface RefundableOrder {
  id: string;
  merchant_id: string;
  order_number?: string | null;
  currency?: string | null;
  amount_paid?: number | null;
  payment_status?: string | null;
}

interface CancellationPaymentTransaction {
  id: string;
  gateway: string;
  gateway_reference: string | null;
  gateway_response: unknown;
  metadata?: unknown;
}

interface GatewayRefundOutcome {
  success: boolean;
  refundId?: number | string;
  error?: string;
}

async function dispatchGatewayRefund(
  order: RefundableOrder,
  transaction: CancellationPaymentTransaction,
  gatewayReference: string,
  refundAmount: number,
  reason: string
): Promise<GatewayRefundOutcome> {
  if (transaction.gateway === 'paystack') {
    const paystackRefund = await initiatePaystackRefund(
      gatewayReference,
      refundAmount * 100, // Convert to kobo
      reason
    );
    return paystackRefund.success
      ? { success: true, refundId: paystackRefund.data.id }
      : { success: false, error: paystackRefund.error };
  }

  if (transaction.gateway === 'korapay') {
    // TODO: Implement Korapay refund
    logger.warn({
      message: 'Korapay refund not yet implemented',
      orderId: order.id,
      transactionRef: transaction.gateway_reference,
    });
    return { success: false, error: 'Korapay refund not yet implemented' };
  }

  logger.warn({
    message: 'Unsupported payment gateway for refund',
    gateway: transaction.gateway,
    orderId: order.id,
  });
  return {
    success: false,
    error: `Unsupported gateway: ${transaction.gateway}`,
  };
}

/**
 * Records the local `transactions` refund audit row. Returns `true` when the
 * insert failed (the gateway refund already succeeded, so this is logged and
 * surfaced as `auditRecordFailed`, never thrown).
 */
async function recordRefundTransaction(
  supabase: SupabaseClient,
  order: RefundableOrder,
  gateway: string,
  refundId: number | string | undefined,
  refundAmount: number
): Promise<boolean> {
  const { error } = await supabase.from('transactions').insert({
    merchant_id: order.merchant_id,
    order_id: order.id,
    transaction_type: 'refund',
    amount: refundAmount,
    currency: order.currency || 'NGN',
    status: 'completed',
    gateway,
    gateway_reference: String(refundId),
    description: `Refund for cancelled order #${
      order.order_number || order.id.slice(0, 8)
    }`,
  });

  if (error) {
    logger.error({
      message: 'Refund processed but failed to create transaction audit record',
      error,
      orderId: order.id,
      refundId,
    });
    return true;
  }
  return false;
}

/**
 * Attempts a full refund of a cancelled order's captured payment. Only runs the
 * gateway refund when the order actually paid; still reports `attempted: true`
 * whenever a nonzero amount was paid, matching the route's response contract.
 */
export async function processOrderCancellationRefund(
  supabase: SupabaseClient,
  order: RefundableOrder,
  cancellationReason: string | undefined
): Promise<OrderCancellationRefundResult> {
  const refundAmount = Number(order.amount_paid) || 0;

  if (!(refundAmount > 0)) {
    return { attempted: false, success: false, amount: refundAmount };
  }

  // amountPaid > 0 → the route reports an attempt even if the order is not in a
  // refundable state (mirrors the original inline behaviour exactly).
  if (order.payment_status !== 'paid') {
    return { attempted: true, success: false, amount: refundAmount };
  }

  const { data: transaction } = await supabase
    .from('transactions')
    .select('id, gateway, gateway_reference, gateway_response, metadata')
    .eq('order_id', order.id)
    .eq('transaction_type', 'payment')
    .eq('status', 'completed')
    .single();

  if (!transaction?.gateway_reference) {
    logger.warn({
      message: 'No transaction found for refund',
      orderId: order.id,
    });
    return {
      attempted: true,
      success: false,
      amount: refundAmount,
      error: 'No completed payment transaction found',
    };
  }

  const reason = cancellationReason || 'Order cancelled';

  // PayPal (BYOK) is a mixed-tender split: the residual settled to PayPal, the
  // prepaid tender (wallet + savings) settled Baci-side. Route through the
  // single splitter, which refunds each leg, records per-channel audit rows,
  // and reports the true `totalRefunded` — never one row claiming the whole
  // amount_paid was refunded via PayPal (F-74).
  if (transaction.gateway === 'paypal') {
    const split = await refundPaypalOrder({
      supabase,
      merchantId: order.merchant_id,
      order: {
        id: order.id,
        order_number: order.order_number,
        currency: order.currency,
      },
      transaction: {
        gateway_response: transaction.gateway_response,
        metadata: transaction.metadata,
      },
      reason,
    });

    let auditRecordFailed = false;
    if (split.success || split.refundPending) {
      const pending = split.refundPending === true;
      try {
        auditRecordFailed = await markPaypalTransactionRefunded(
          undefined,
          transaction.id,
          pending
            ? 'order cancellation refund pending'
            : 'order cancellation refund completed',
          {
            pending,
            ...(pending ? { restorePrepaidOnReconcile: true } : {}),
            ...(pending && split.pendingRefundIds?.length
              ? { pendingRefundIds: split.pendingRefundIds }
              : {}),
          }
        );
      } catch (error) {
        auditRecordFailed = true;
        logger.error({
          message:
            'PayPal cancellation refund succeeded but the terminal transaction audit rejected',
          error,
          orderId: order.id,
          transactionId: transaction.id,
        });
      }
    }
    return {
      attempted: true,
      success: split.success,
      amount: split.totalRefunded,
      refundId: split.paypalRefundIds[0],
      error: split.error,
      ...(auditRecordFailed ? { auditRecordFailed: true } : {}),
    };
  }

  const outcome = await dispatchGatewayRefund(
    order,
    transaction as CancellationPaymentTransaction,
    transaction.gateway_reference,
    refundAmount,
    reason
  );

  if (!outcome.success) {
    return {
      attempted: true,
      success: false,
      amount: refundAmount,
      error: outcome.error,
    };
  }

  const auditRecordFailed = await recordRefundTransaction(
    supabase,
    order,
    transaction.gateway,
    outcome.refundId,
    refundAmount
  );

  return {
    attempted: true,
    success: true,
    amount: refundAmount,
    refundId: outcome.refundId,
    ...(auditRecordFailed ? { auditRecordFailed: true } : {}),
  };
}
