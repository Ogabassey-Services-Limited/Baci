import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import { validatePaypalCaptureSet } from '@/lib/payments/paypal-capture-validation';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';
import {
  type PaypalReconcilePreCaptureStatus,
  reconcilePaypalOrderToPaid,
} from '@/lib/payments/reconcile-paypal-order';
import { getOrder, type PayPalMode } from '@/lib/paypal';

/**
 * Runs the `reconcile_completed_unpaid` path for the create-order double-charge
 * guards (see docs/payments/paypal-capture-reconciliation-design.md §4b last
 * paragraph, §5 F-393). Both create-order guards — the completed-txn guard and
 * the `already_captured` reuse branch — funnel through THIS helper so a PayPal
 * order that already captured is reconciled to paid idempotently instead of
 * minting a second approval+capture. The route then returns 409.
 *
 * When the local transaction is still `pending` (the reuse branch: PayPal
 * captured but our txn write was lost), it fetches the PayPal order, validates
 * the captured set against the stored presentment, and flips the txn to
 * `completed` with the real gateway_response BEFORE calling the idempotent
 * writer — so the refund funnel and settlement have a real capture response.
 */
export async function reconcileCompletedPaypalOrderForCreate(
  supabase: SupabaseClient,
  input: {
    /** Required only for the pending-txn reuse branch (to fetch PayPal). The
     * completed-txn guard already has the persisted capture response. */
    credentials?: { clientId: string; secretKey: string };
    mode?: PayPalMode;
    merchantId: string;
    orderId: string;
    paypalOrderId: string;
    orderTotal: number;
    preCaptureStatus: PaypalReconcilePreCaptureStatus;
  }
): Promise<void> {
  const {
    credentials,
    mode,
    merchantId,
    orderId,
    paypalOrderId,
    orderTotal,
    preCaptureStatus,
  } = input;

  const { data: txn } = await supabase
    .from('transactions')
    .select('id, amount, status, metadata')
    .eq('gateway', 'paypal')
    .eq('gateway_reference', paypalOrderId)
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (!txn) {
    logger.warn({
      message:
        'PayPal create-order reconcile: no transaction row for captured order',
      orderId,
      paypalOrderId,
    });
    return;
  }

  const lockedResidual = Number(txn.amount) || 0;
  const metadata = (txn.metadata as Record<string, unknown> | null) ?? {};

  // When the local txn is still pending, PayPal captured but our write was
  // lost. Fetch the live order, validate the captures, and persist the real
  // response before reconciling. This requires credentials (the reuse branch).
  if (txn.status !== 'completed') {
    if (!credentials || !mode) {
      logger.warn({
        message:
          'PayPal create-order reconcile: pending txn but no credentials to fetch PayPal order',
        orderId,
        paypalOrderId,
      });
      return;
    }
    const remote = await getOrder(
      credentials.clientId,
      credentials.secretKey,
      paypalOrderId,
      mode
    );
    if (!remote.success || remote.data.status !== 'COMPLETED') {
      logger.warn({
        message:
          'PayPal create-order reconcile: order not COMPLETED at PayPal; nothing captured',
        orderId,
        paypalOrderId,
        status: remote.success ? remote.data.status : undefined,
      });
      return;
    }

    const purchaseUnits = (remote.data.purchase_units ?? []).map((unit) => ({
      payments: { captures: unit.payments?.captures ?? [] },
    }));
    const expectedAmount = Number(metadata.paypal_presentment_amount);
    const expectedCurrency =
      typeof metadata.paypal_presentment_currency === 'string'
        ? metadata.paypal_presentment_currency
        : undefined;
    const validation = validatePaypalCaptureSet(
      { purchase_units: purchaseUnits },
      expectedAmount,
      expectedCurrency
    );
    if (!validation.ok) {
      // COMPLETED means the buyer's funds are already captured. Refund before
      // bailing out, or the retry gets blocked while the capture sits unrefunded
      // in the merchant's PayPal account (same contract as the other post-capture
      // validation paths).
      const refund = await initiatePaypalOrderRefund({
        merchantId,
        gatewayResponse: remote.data,
        reason:
          'PayPal captured but the set failed validation during create-order reconcile; refunding',
      });
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypalOrderId,
        merchantId,
        orderId,
        reason:
          'PayPal order reported COMPLETED but the captured set failed validation during create-order reconcile',
        transactionId: txn.id,
        metadata: {
          stage: 'create_reconcile_validation',
          reason: validation.reason,
          refundSucceeded: refund.success,
          refundError: refund.error ?? null,
        },
      });
      return;
    }

    const { error: flipError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: remote.data as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id)
      .eq('status', 'pending');
    if (flipError) {
      logger.warn({
        message:
          'PayPal create-order reconcile: failed to flip pending txn to completed',
        error: flipError,
        transactionId: txn.id,
      });
      // Fall through: the writer's CAS is still idempotent; a concurrent flip
      // may already have won.
    }
  }

  await reconcilePaypalOrderToPaid({
    supabase,
    merchantId,
    orderId,
    paypalOrderId,
    transactionId: txn.id,
    lockedResidual,
    orderTotal,
    prepaidTender: Math.max(orderTotal - lockedResidual, 0),
    preCaptureStatus,
  });
}
