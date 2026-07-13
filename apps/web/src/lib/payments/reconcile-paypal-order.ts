import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { after, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ensurePaidOrderInventoryConfirmed } from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import { orderNumberFallback } from '@/lib/payments/load-paypal-capture-context';
import { isCancelledPaymentStatus } from '@/lib/payments/non-payable-payment-statuses';
import { runPaypalCaptureSideEffects } from '@/lib/payments/paypal-capture-side-effects';
import { handlePaypalReconcileInventoryFailure } from '@/lib/payments/reconcile-paypal-inventory';
import { refundDuplicatePaypalCapture } from '@/lib/payments/refund-duplicate-paypal-capture';

/**
 * The ONE idempotent writer that advances a PayPal order to `paid` and runs the
 * post-capture side effects (see
 * docs/payments/paypal-capture-reconciliation-design.md §4b). Every path that
 * settles a PayPal order — fresh capture, completed-but-unpaid reconcile, the
 * create-order double-charge guard, and verify — calls this and nothing else,
 * so `amount_paid`, the settlement, the confirmation email and the fee accrual
 * all fire exactly once no matter how many capture/reconcile paths race.
 *
 * Funds are ALREADY captured to the merchant's own PayPal account when this
 * runs, so nothing is swallowed:
 *  - cancelled-clamp → suppress side effects + file manual-refund review (F1),
 *  - serialized-inventory shortfall → roll payment_status + shipping_status +
 *    amount_paid back to pre-capture, file review, 409 (F-182),
 *  - transient inventory error → rollback (+ cleanup review on failure), 500.
 */

export interface PaypalReconcilePreCaptureStatus {
  payment_status: string | null;
  shipping_status: string | null;
  amount_paid: number | string | null;
}

export interface ReconcilePaypalOrderInput {
  supabase: SupabaseClient;
  merchantId: string;
  orderId: string;
  paypalOrderId: string;
  transactionId: string;
  /** Order-ccy residual PayPal captured; becomes `paypal_split.paypalResidualPaid`. */
  lockedResidual: number;
  orderTotal: number;
  /** wallet + savings already settled Baci-side; == orderTotal − lockedResidual. */
  prepaidTender: number;
  preCaptureStatus: PaypalReconcilePreCaptureStatus;
}

const ORDER_SELECT =
  'id, order_number, customer_id, total, subtotal, shipping_fee, customer_name, customer_email, customer_phone, shipping_address, currency, shipping_status, cancelled_at, order_items(name, quantity, price, variant_name)';

function persistFailureResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Failed to persist captured payment',
      code: 'CAPTURE_PERSIST_FAILED',
    },
    { status: 500 }
  );
}

/**
 * Writes the settlement split onto the transaction metadata so the refund
 * funnel reads an exact `{ paypalResidualPaid, prepaidPaid }` split instead of
 * assuming the whole `amount_paid` went to PayPal (F-74). Idempotent overwrite;
 * best-effort — a captured payment is already recorded.
 */
async function persistPaypalSplit(
  supabase: SupabaseClient,
  transactionId: string,
  paypalResidualPaid: number,
  prepaidPaid: number
): Promise<void> {
  try {
    const { data: txnRow } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', transactionId)
      .maybeSingle();
    const existingMetadata =
      (txnRow?.metadata as Record<string, unknown> | null) ?? {};
    const { error } = await supabase
      .from('transactions')
      .update({
        metadata: {
          ...existingMetadata,
          paypal_split: { paypalResidualPaid, prepaidPaid },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    if (error) {
      logger.warn({
        message: 'PayPal reconcile: failed to persist paypal_split metadata',
        error,
        transactionId,
      });
    }
  } catch (error) {
    logger.warn({
      message: 'PayPal reconcile: paypal_split metadata write threw',
      error,
      transactionId,
    });
  }
}

export async function reconcilePaypalOrderToPaid(
  input: ReconcilePaypalOrderInput
): Promise<NextResponse> {
  const {
    supabase,
    merchantId,
    orderId,
    paypalOrderId,
    transactionId,
    lockedResidual,
    orderTotal,
    preCaptureStatus,
  } = input;

  // 1. CAS claim: only the request that flips unpaid→paid records amount_paid
  //    and runs the side effects; concurrent reconciles find the order already
  //    paid and return idempotent success. `amount_paid` is set once here.
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      amount_paid: orderTotal,
      // Stamp the settling transaction ATOMICALLY with the paid flip. This is
      // the authoritative "which txn settled this order" signal used by the
      // resolver, /verify and the CAS-loser branch below — it survives a lost
      // best-effort split write, so a legit capture is never mistaken for a
      // duplicate and a duplicate is never confirmed without a refund.
      paid_transaction_id: transactionId,
      ...(preCaptureStatus.shipping_status === 'pending' && {
        shipping_status: 'processing',
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .neq('payment_status', 'paid')
    // Never resurrect a refunded order. The capture-route resolver already
    // blocks refunded, but the verify + create-order reconcile paths call this
    // writer directly; without this guard `.neq(paid)` alone would flip
    // refunded→paid and re-run settlement/email/fee. Handled as a 409 below.
    .neq('payment_status', 'refunded')
    // Never settle an order the buyer already financed. A BNPL-approved order has
    // no cash against it, so `.neq(paid)` lets it through — and the lender is
    // already committed to pay the merchant, so settling a PayPal capture on top
    // charges the buyer twice for one order. The resolver now blocks this too;
    // this is the backstop for any writer path that reaches here directly.
    .neq('payment_status', 'bnpl_approved')
    // And never resurrect a dead checkout. The abandoned-order cron sets
    // payment_status='cancelled' while leaving shipping_status='pending', so the
    // shipping-status guards elsewhere do not see it. Declined here → refunded by
    // the terminal-status branch below, not stranded.
    .neq('payment_status', 'cancelled')
    .neq('payment_status', 'expired')
    .select(ORDER_SELECT)
    .maybeSingle();

  if (orderError) {
    await filePaypalCapturePersistFailureReview({
      gatewayReference: paypalOrderId,
      merchantId,
      orderId,
      reason: 'PayPal capture completed but order payment status update failed',
      transactionId,
      metadata: { stage: 'order_update' },
    });
    return persistFailureResponse();
  }

  if (!order) {
    // CAS matched no row: a concurrent request already claimed the order, or it
    // genuinely could not update. Re-read to tell them apart.
    const { data: existing } = await supabase
      .from('orders')
      .select('order_number, payment_status, paid_transaction_id')
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (existing?.payment_status === 'paid') {
      const paidTransactionId = existing.paid_transaction_id as string | null;
      // A DIFFERENT transaction settled this order after we loaded state but
      // before this CAS, yet every path into this writer runs AFTER PayPal
      // captured funds — so this request's capture is a genuine duplicate.
      // Refund it instead of returning a bare success (F1). Only auto-refund
      // when the marker proves another txn settled it; a null marker (settled
      // by a non-PayPal tender or before this marker existed) is flagged for a
      // manual duplicate check rather than risking a claw-back of a real
      // payment.
      if (paidTransactionId && paidTransactionId !== transactionId) {
        const { data: txnRow } = await supabase
          .from('transactions')
          .select('gateway_response')
          .eq('id', transactionId)
          .maybeSingle();
        return refundDuplicatePaypalCapture({
          merchantId,
          orderId,
          transactionId,
          gatewayReference: paypalOrderId,
          gatewayResponse: txnRow?.gateway_response ?? null,
          orderNumber: existing.order_number ?? null,
          source: 'reconcile',
        });
      }
      if (!paidTransactionId) {
        await filePaypalCapturePersistFailureReview({
          gatewayReference: paypalOrderId,
          merchantId,
          orderId,
          reason:
            'PayPal capture completed on an order already paid with no settling-txn marker; manual duplicate check needed',
          transactionId,
          metadata: { stage: 'paid_no_settler_marker' },
        });
      }
      // paidTransactionId === transactionId: this txn settled the order and this
      // is an idempotent retry — success, no refund.
      return NextResponse.json({
        success: true,
        status: 'success',
        orderNumber: existing.order_number || orderNumberFallback(orderId),
      });
    }

    // The CAS was declined because the order is refunded, not because of a race.
    // Do NOT re-settle it (that would re-emit the settlement/email/fee). But
    // every path into this writer runs AFTER PayPal captured funds, so a stale
    // capture landing on an already-refunded order would otherwise sit in the
    // merchant's PayPal account forever. Refund it and file the review rather
    // than returning a bare 409.
    if (existing?.payment_status === 'refunded') {
      logger.warn({
        message:
          'PayPal reconcile: capture landed on a refunded order; refunding the stale capture',
        orderId,
        paypalOrderId,
        transactionId,
      });
      const { data: refundedTxnRow } = await supabase
        .from('transactions')
        .select('gateway_response')
        .eq('id', transactionId)
        .maybeSingle();
      await refundDuplicatePaypalCapture({
        merchantId,
        orderId,
        transactionId,
        gatewayReference: paypalOrderId,
        gatewayResponse: refundedTxnRow?.gateway_response ?? null,
        orderNumber: existing.order_number ?? null,
        source: 'reconcile_refunded_order',
      });
      return NextResponse.json(
        {
          error: 'Order was refunded and cannot be re-settled',
          code: 'ORDER_ALREADY_REFUNDED',
        },
        { status: 409 }
      );
    }

    // The CAS was declined because the order is terminal for a reason other than
    // refunded: it was cancelled/expired (the abandoned-order cron sets
    // payment_status='cancelled' while leaving shipping_status='pending', so a
    // late PayPal approval lands here), or the buyer financed it with BNPL. Money
    // HAS been captured by the time any path reaches this writer — declining the
    // CAS without refunding would strand it in the merchant's account against an
    // order we refuse to settle. Give it back, exactly as the refunded branch does.
    const terminalStatus = existing?.payment_status;
    if (
      isCancelledPaymentStatus(terminalStatus) ||
      terminalStatus === 'bnpl_approved'
    ) {
      logger.warn({
        message:
          'PayPal reconcile: capture landed on a terminal order; refunding the stale capture',
        orderId,
        paypalOrderId,
        transactionId,
        paymentStatus: terminalStatus,
      });
      const { data: terminalTxnRow } = await supabase
        .from('transactions')
        .select('gateway_response')
        .eq('id', transactionId)
        .maybeSingle();
      await refundDuplicatePaypalCapture({
        merchantId,
        orderId,
        transactionId,
        gatewayReference: paypalOrderId,
        gatewayResponse: terminalTxnRow?.gateway_response ?? null,
        orderNumber: existing?.order_number ?? null,
        source:
          terminalStatus === 'bnpl_approved'
            ? 'reconcile_bnpl_order'
            : 'reconcile_cancelled_order',
      });
      return NextResponse.json(
        {
          error: 'Order is no longer payable and cannot be settled',
          code: 'ORDER_NOT_PAYABLE',
        },
        { status: 409 }
      );
    }

    await filePaypalCapturePersistFailureReview({
      gatewayReference: paypalOrderId,
      merchantId,
      orderId,
      reason: 'PayPal capture completed but order payment status update failed',
      transactionId,
      metadata: { stage: 'order_update' },
    });
    return persistFailureResponse();
  }

  // 2. Cancelled-clamp: the prevent_cancelled_order_reopen trigger kept the
  //    returned row cancelled. Suppress side effects, file manual-refund review.
  if (isOrderClampedAsCancelled(order)) {
    await handlePaymentForCancelledOrder({
      gatewayReference: paypalOrderId,
      order,
      reason:
        'PayPal capture completed for an order cancelled before finalization',
      transactionId,
    });
    return NextResponse.json({
      success: true,
      status: 'success',
      orderNumber: order.order_number || orderNumberFallback(orderId),
    });
  }

  // 3. Persist the exact settlement split for the refund funnel (F-74).
  await persistPaypalSplit(
    supabase,
    transactionId,
    lockedResidual,
    orderTotal - lockedResidual
  );

  // 4. Confirm serialized/reserved inventory BEFORE notifying/settling. On a
  //    failure, roll back to pre-capture status + file review (F-182).
  try {
    await ensurePaidOrderInventoryConfirmed(supabase, merchantId, orderId);
  } catch (inventoryError) {
    return handlePaypalReconcileInventoryFailure(
      supabase,
      { merchantId, orderId, paypalOrderId, transactionId, preCaptureStatus },
      inventoryError
    );
  }

  // 5. Side effects (notify + confirmation email w/ currency + direct-to-
  //    merchant settlement + fee accrual). Because this is inside the writer,
  //    EVERY funnel path settles — including verify (F-101).
  after(() =>
    runPaypalCaptureSideEffects({
      merchantId,
      order,
      paypalOrderId,
      grossAmount: lockedResidual,
    })
  );

  return NextResponse.json({
    success: true,
    status: 'success',
    orderNumber: order.order_number || orderNumberFallback(orderId),
  });
}
