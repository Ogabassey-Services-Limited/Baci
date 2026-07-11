import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { after, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  ensurePaidOrderInventoryConfirmed,
  isSerializedInventoryUnavailableError,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import { orderNumberFallback } from '@/lib/payments/load-paypal-capture-context';
import { runPaypalCaptureSideEffects } from '@/lib/payments/paypal-capture-side-effects';

/**
 * Advances a PayPal order to `paid` and runs the post-capture side effects
 * (Wave 2, see docs/payments/byok-payment-providers-plan.md Phase 2). Shared by
 * both the fresh-capture path and the completed-but-unpaid reconcile path so the
 * paid-order finalization is identical to the sibling gateway finalizers.
 *
 * Funds are ALREADY captured to the merchant's own PayPal account when this
 * runs, so failures are never swallowed:
 *
 * - If the `prevent_cancelled_order_reopen` trigger clamped the reopen (the
 *   returned row is still `cancelled`), suppress every paid-order side effect and
 *   file a `payment_received_after_cancellation` reconciliation row for manual
 *   refund — mirrors /api/payments/verify (F1).
 * - Before scheduling side effects, confirm serialized/reserved inventory. On a
 *   serialized shortfall file a reconciliation row and return 409; on a transient
 *   error roll the order back to its pre-capture status (F5).
 */
export async function finalizePaypalCaptureOrder({
  supabase,
  merchantId,
  orderId,
  paypalOrderId,
  transaction,
  orderSnapshot,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  orderId: string;
  paypalOrderId: string;
  transaction: { id: string; amount: number };
  orderSnapshot: {
    order_number: string | null;
    shipping_status: string | null;
    payment_status?: string | null;
  };
}): Promise<NextResponse> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      ...(orderSnapshot.shipping_status === 'pending' && {
        shipping_status: 'processing',
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .select(
      'id, order_number, customer_id, total, subtotal, shipping_fee, customer_name, customer_email, customer_phone, shipping_address, currency, shipping_status, cancelled_at, order_items(name, quantity, price, variant_name)'
    )
    .single();

  if (orderError || !order) {
    // Transaction is completed but the order didn't advance to paid — file a
    // reconciliation row so ops can reconcile (Phase 2.4).
    await filePaypalCapturePersistFailureReview({
      gatewayReference: paypalOrderId,
      merchantId,
      orderId,
      reason: 'PayPal capture completed but order payment status update failed',
      transactionId: transaction.id,
      metadata: { stage: 'order_update' },
    });
    return NextResponse.json(
      {
        error: 'Failed to persist captured payment',
        code: 'CAPTURE_PERSIST_FAILED',
      },
      { status: 500 }
    );
  }

  // F1: the prevent_cancelled_order_reopen trigger clamps a reopen of a
  // cancelled order — the returned row still reads shipping_status 'cancelled'.
  // Suppress all paid-order side effects (push, confirmation email, settlement)
  // and file a reconciliation row for manual refund. Still return success.
  if (isOrderClampedAsCancelled(order)) {
    await handlePaymentForCancelledOrder({
      gatewayReference: paypalOrderId,
      order,
      reason:
        'PayPal capture completed for an order cancelled before finalization',
      transactionId: transaction.id,
    });
    return NextResponse.json({
      success: true,
      status: 'success',
      orderNumber: order.order_number || orderNumberFallback(orderId),
    });
  }

  // F5: confirm serialized/reserved inventory before notifying/settling. Funds
  // are already captured, so a failure must never silently mark paid and
  // proceed — mirror the verify/klump finalizers.
  try {
    await ensurePaidOrderInventoryConfirmed(supabase, merchantId, orderId);
  } catch (inventoryError) {
    logger.error({
      message: 'PayPal capture failed to confirm inventory',
      orderId,
      error: inventoryError,
    });

    if (isSerializedInventoryUnavailableError(inventoryError)) {
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypalOrderId,
        merchantId,
        orderId,
        reason:
          'PayPal capture completed but serialized inventory could not be confirmed',
        transactionId: transaction.id,
        metadata: { stage: 'inventory_confirmation' },
      });
      return NextResponse.json(
        {
          code: 'serialized_inventory_unavailable',
          error: 'serialized_inventory_unavailable',
        },
        { status: 409 }
      );
    }

    try {
      await rollbackOrderStatusAfterInventoryConfirmationFailure(
        supabase,
        merchantId,
        orderId,
        {
          payment_status: orderSnapshot.payment_status ?? null,
          shipping_status: orderSnapshot.shipping_status ?? null,
        }
      );
    } catch (rollbackError) {
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypalOrderId,
        merchantId,
        orderId,
        reason:
          'PayPal capture reached paid state, but serialized inventory confirmation and status rollback both failed',
        transactionId: transaction.id,
        metadata: {
          stage: 'inventory_confirmation_rollback',
          inventoryError:
            inventoryError instanceof Error
              ? inventoryError.message
              : String(inventoryError),
          rollbackError:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        },
      });
      return NextResponse.json(
        {
          code: 'INVENTORY_CONFIRMATION_CLEANUP_FAILED',
          error: 'Inventory confirmation cleanup failed',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        code: 'INVENTORY_CONFIRMATION_FAILED',
        error: 'Inventory confirmation failed',
      },
      { status: 500 }
    );
  }

  after(() =>
    runPaypalCaptureSideEffects({
      merchantId,
      order,
      paypalOrderId,
      grossAmount: Number(transaction.amount),
    })
  );

  return NextResponse.json({
    success: true,
    status: 'success',
    orderNumber: order.order_number || orderNumberFallback(orderId),
  });
}
