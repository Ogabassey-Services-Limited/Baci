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
      // The unique index is (issue_type, order_id), but this helper files MANY
      // distinct problems (duplicate capture, failed refund, mode mismatch, stale
      // amount…) across different transactions of the same order. Treating every
      // 23505 as a retry no-op therefore DROPS the second, different problem from
      // the ops queue. Append it to the existing row instead, so nothing is lost.
      await appendOccurrenceToExistingReview(supabase, {
        gatewayReference,
        merchantId,
        metadata,
        orderId,
        reason,
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

/**
 * Folds a NEW distinct problem into the order's existing open review row.
 *
 * The `(issue_type, order_id)` unique index means only one row per order can
 * exist for this issue type, but the same order can hit several genuinely
 * different problems (a duplicate capture, then a refund that failed, then a mode
 * mismatch) — possibly on different transactions. Suppressing those as retries
 * would quietly shrink the ops queue to the first event, so each subsequent one is
 * appended to `metadata.occurrences` and the row's `reason` is refreshed to the
 * latest.
 *
 * Best-effort and non-throwing: the money is already captured, and the caller's
 * error response matters more than this bookkeeping.
 */
async function appendOccurrenceToExistingReview(
  supabase: ReturnType<typeof createAdminClient>,
  {
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
  }
): Promise<void> {
  // The unique index that raised the 23505 is PARTIAL (`WHERE resolved_at IS
  // NULL`), so only the OPEN row conflicts. Reading without the same predicate
  // matches resolved historical rows too, `maybeSingle()` errors on the multiple
  // rows, and the new occurrence is dropped — precisely on the orders with the
  // most history, which are the ones ops most needs to see.
  const { data: existing, error: readError } = await supabase
    .from('reconciliation_review')
    .select('id, metadata')
    .eq('issue_type', RECONCILIATION_ISSUE_TYPE)
    .eq('order_id', orderId)
    .is('resolved_at', null)
    .maybeSingle();

  if (readError || !existing) {
    logger.error({
      error: readError,
      gatewayReference,
      message:
        'PayPal review row conflicted but could not be read back to append the new occurrence',
      orderId,
      transactionId,
    });
    return;
  }

  const existingMetadata =
    (existing.metadata as Record<string, unknown> | null) ?? {};
  const occurrences = Array.isArray(existingMetadata.occurrences)
    ? (existingMetadata.occurrences as unknown[])
    : [];

  const { error: updateError } = await supabase
    .from('reconciliation_review')
    .update({
      reason,
      paystack_ref: gatewayReference,
      txn_id: transactionId,
      metadata: {
        ...existingMetadata,
        occurrences: [
          ...occurrences,
          {
            ...(metadata ?? {}),
            reason,
            merchant_id: merchantId,
            txn_id: transactionId,
            gateway_reference: gatewayReference,
            at: new Date().toISOString(),
          },
        ],
      },
    })
    .eq('id', existing.id);

  if (updateError) {
    logger.error({
      error: updateError,
      gatewayReference,
      message:
        'Failed to append a new PayPal reconciliation occurrence to the existing review row',
      orderId,
      transactionId,
    });
  }
}
