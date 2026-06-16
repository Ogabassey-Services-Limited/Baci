import 'server-only';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

const RECONCILIATION_ISSUE_TYPE = 'serialized_inventory_confirmation_failed';
const POSTGRES_UNIQUE_VIOLATION = '23505';

export async function fileInventoryConfirmationFailureReview({
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
      'Paid-order inventory confirmation failed; filing reconciliation review',
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

  // Filing reconciliation review rows is best-effort: payment flows must not
  // throw after funds were captured solely because the ops queue insert failed.
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
          'serialized_inventory_confirmation_failed reconciliation already filed (expected retry no-op)',
        orderId,
        transactionId,
      });
      return;
    }

    logger.error({
      error,
      gatewayReference,
      message: 'Failed to file serialized inventory reconciliation review',
      orderId,
      transactionId,
    });
  } catch (error) {
    logger.error({
      error,
      gatewayReference,
      message:
        'Failed to file serialized inventory reconciliation review (threw)',
      orderId,
      transactionId,
    });
  }
}
