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
import { runPaypalCaptureSideEffects } from '@/lib/payments/paypal-capture-side-effects';
import { handlePaypalReconcileInventoryFailure } from '@/lib/payments/reconcile-paypal-inventory';

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
      .select('order_number, payment_status')
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (existing?.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'success',
        orderNumber: existing.order_number || orderNumberFallback(orderId),
      });
    }

    // The CAS was declined because the order is refunded, not because of a race.
    // Do NOT re-settle it (that would re-emit the settlement/email/fee); the
    // captured funds are handled by the refund path. Report a blocked 409.
    if (existing?.payment_status === 'refunded') {
      logger.warn({
        message: 'PayPal reconcile: refused to re-settle a refunded order',
        orderId,
        paypalOrderId,
        transactionId,
      });
      return NextResponse.json(
        {
          error: 'Order was refunded and cannot be re-settled',
          code: 'ORDER_ALREADY_REFUNDED',
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
