import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  isSerializedInventoryUnavailableError,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import type { PaypalReconcilePreCaptureStatus } from '@/lib/payments/reconcile-paypal-order';

/**
 * Handles an inventory-confirmation failure inside the PayPal reconcile writer
 * (see docs/payments/paypal-capture-reconciliation-design.md §4b step 4). Split
 * out to keep the writer under the 300-line cap.
 *
 * Both the serialized-shortfall and the transient branch roll the order back to
 * its pre-capture status (payment_status + shipping_status + amount_paid) so a
 * refresh sees unpaid and retries cleanly (F-182 — the old serialized branch
 * returned 409 while leaving the order reading paid).
 */
export async function handlePaypalReconcileInventoryFailure(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    paypalOrderId: string;
    transactionId: string;
    preCaptureStatus: PaypalReconcilePreCaptureStatus;
  },
  inventoryError: unknown
): Promise<NextResponse> {
  const {
    merchantId,
    orderId,
    paypalOrderId,
    transactionId,
    preCaptureStatus,
  } = input;

  logger.error({
    message: 'PayPal reconcile failed to confirm inventory',
    orderId,
    error: inventoryError,
  });

  const serialized = isSerializedInventoryUnavailableError(inventoryError);
  try {
    await rollbackOrderStatusAfterInventoryConfirmationFailure(
      supabase,
      merchantId,
      orderId,
      {
        payment_status: preCaptureStatus.payment_status,
        shipping_status: preCaptureStatus.shipping_status,
        amount_paid: preCaptureStatus.amount_paid ?? 0,
        // Undo the settler marker too. The CAS stamped it in the same statement
        // that flipped the order to paid, so leaving it behind on a now-unpaid
        // order would make a later verify/capture retry treat this stale PayPal
        // txn as the settler of whatever tender eventually pays the order.
        paid_transaction_id: null,
      }
    );
  } catch (rollbackError) {
    await filePaypalCapturePersistFailureReview({
      gatewayReference: paypalOrderId,
      merchantId,
      orderId,
      reason:
        'PayPal capture reached paid state, but inventory confirmation and status rollback both failed',
      transactionId,
      metadata: {
        stage: 'inventory_confirmation_rollback',
        serialized,
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

  if (serialized) {
    await filePaypalCapturePersistFailureReview({
      gatewayReference: paypalOrderId,
      merchantId,
      orderId,
      reason:
        'PayPal capture completed but serialized inventory could not be confirmed',
      transactionId,
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

  return NextResponse.json(
    {
      code: 'INVENTORY_CONFIRMATION_FAILED',
      error: 'Inventory confirmation failed',
    },
    { status: 500 }
  );
}
