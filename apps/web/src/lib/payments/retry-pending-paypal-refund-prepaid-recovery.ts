import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { restorePendingPaypalRefundPrepaidTender } from './restore-pending-paypal-refund-prepaid-tender';

/**
 * Retries a pending cancellation refund's prepaid leg and rotates failed rows
 * for the next bounded sweep. Returns true only when the transaction may safely
 * advance to refunded.
 */
export async function retryPendingPaypalRefundPrepaidRecovery(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    transactionId: string;
    transactionMetadata: unknown;
    checkedAt: string;
  }
): Promise<boolean> {
  let prepaidRestored = false;
  try {
    prepaidRestored = await restorePendingPaypalRefundPrepaidTender(supabase, {
      merchantId: input.merchantId,
      orderId: input.orderId,
      transactionMetadata: input.transactionMetadata,
    });
  } catch (error) {
    logger.error({
      message: 'PayPal refund sweep: prepaid tender recovery threw for one row',
      error,
      orderId: input.orderId,
      transactionId: input.transactionId,
    });
  }

  if (prepaidRestored) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('transactions')
      .update({ updated_at: input.checkedAt })
      .eq('id', input.transactionId)
      .eq('status', 'refund_pending');
    if (error) {
      logger.error({
        message: 'PayPal refund sweep: failed to defer prepaid recovery retry',
        error,
        orderId: input.orderId,
        transactionId: input.transactionId,
      });
    }
  } catch (error) {
    logger.error({
      message: 'PayPal refund sweep: failed to defer prepaid recovery retry',
      error,
      orderId: input.orderId,
      transactionId: input.transactionId,
    });
  }

  return false;
}
