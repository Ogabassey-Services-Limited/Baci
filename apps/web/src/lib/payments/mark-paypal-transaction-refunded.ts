import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Makes a refunded PayPal capture non-settleable through a locked database
 * transition. The RPC merges pending-refund metadata and changes status in one
 * transaction, so concurrent writers cannot lose reconciliation state.
 *
 * Best-effort by design: the PayPal refund already succeeded or was accepted,
 * so a failed local audit must be surfaced without submitting another refund.
 * Returns true when the audit transition did not update exactly one row.
 */
export async function markPaypalTransactionRefunded(
  serviceClient: SupabaseClient | undefined,
  transactionId: string,
  reason: string,
  options?: {
    pending?: boolean;
    pendingRefundIds?: string[];
    restorePrepaidOnReconcile?: boolean;
  }
): Promise<boolean> {
  const status = options?.pending ? 'refund_pending' : 'refunded';
  const client = serviceClient ?? createServiceClient();

  try {
    const { data, error } = await client.rpc(
      'mark_paypal_transaction_refunded',
      {
        p_transaction_id: transactionId,
        p_status: status,
        p_pending_refund_ids: options?.pendingRefundIds ?? [],
        p_restore_prepaid_on_reconcile:
          options?.restorePrepaidOnReconcile ?? false,
      }
    );

    if (error || data !== true) {
      logger.error({
        message:
          'PayPal refund: atomic terminal transaction audit did not update one row',
        errorCode: error?.code,
        status,
        transactionId,
        reason,
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error({
      message: 'PayPal refund: atomic terminal transaction audit threw',
      error,
      transactionId,
      reason,
    });
    return true;
  }
}
