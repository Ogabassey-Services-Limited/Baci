import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Files a `paypal_capture_persist_failed` reconciliation_review row when a
 * PayPal capture SUCCEEDED (funds are captured into the merchant's account)
 * but the follow-up Baci DB write failed, leaving the order/transaction stuck
 * (Wave 2, see docs/payments/byok-payment-providers-plan.md Phase 2 item 4).
 * Mirrors `fileInventoryConfirmationFailureReview`: a captured payment must
 * never be lost silently — ops gets a queue row to reconcile by hand.
 *
 * Best-effort insert: the payment is already captured, so the ops-queue write
 * must never throw over the caller (which will still return a 500 with a
 * stable code). The generic `(issue_type, order_id)` partial unique index on
 * reconciliation_review makes a retry a benign 23505 no-op.
 */

const RECONCILIATION_ISSUE_TYPE = 'paypal_capture_persist_failed';
const POSTGRES_UNIQUE_VIOLATION = '23505';

export async function filePaypalCapturePersistFailureReview({
  gatewayReference,
  merchantId,
  metadata,
  orderId,
  reason,
  transactionId,
}: {
  gatewayReference: string | null;
  merchantId: string;
  metadata?: Record<string, unknown>;
  orderId: string;
  reason: string;
  transactionId: string | null;
}): Promise<void> {
  logger.warn({
    gatewayReference,
    message:
      'PayPal capture succeeded but DB persist failed; filing reconciliation review',
    orderId,
    transactionId,
  });

  const reviewRow = {
    candidates: null,
    issue_type: RECONCILIATION_ISSUE_TYPE,
    merchant_id: merchantId,
    order_id: orderId,
    paystack_ref: gatewayReference,
    reason,
    txn_id: transactionId,
    metadata: metadata ?? {},
  };

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('reconciliation_review')
      .insert(reviewRow);

    if (!error) {
      return;
    }

    if (error.code === POSTGRES_UNIQUE_VIOLATION) {
      logger.info({
        gatewayReference,
        message:
          'paypal_capture_persist_failed reconciliation already filed (expected retry no-op)',
        orderId,
        transactionId,
      });
      return;
    }

    logger.error({
      error,
      gatewayReference,
      message: 'Failed to file PayPal capture-persist reconciliation review',
      orderId,
      transactionId,
    });
  } catch (error) {
    logger.error({
      error,
      gatewayReference,
      message:
        'Failed to file PayPal capture-persist reconciliation review (threw)',
      orderId,
      transactionId,
    });
  }
}
