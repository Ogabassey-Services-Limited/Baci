import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { restorePrepaidTender } from './refund-paypal-prepaid';
import { resolvePaypalSplit } from './resolve-paypal-split';

/**
 * Completes the Baci-side leg of an asynchronous PayPal cancellation refund.
 * The wallet RPC is order-idempotent and the savings RPC only stamps an
 * unreversed row, so the refund sweeper can retry this until both audits land.
 */
export async function restorePendingPaypalRefundPrepaidTender(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    transactionMetadata: unknown;
  }
): Promise<boolean> {
  const split = await resolvePaypalSplit(
    supabase,
    input.merchantId,
    input.orderId,
    input.transactionMetadata
  );

  if ('failed' in split) {
    logger.error({
      message:
        'PayPal refund sweep: could not resolve prepaid tender for recovery',
      merchantId: input.merchantId,
      orderId: input.orderId,
      reason: split.reason,
    });
    return false;
  }

  const restored = await restorePrepaidTender(supabase, {
    merchantId: input.merchantId,
    orderId: input.orderId,
    customerId: split.customerId,
    prepaidPaid: split.prepaidPaid,
    savingsAmountUsed: split.savingsAmountUsed,
    reason: 'PayPal cancellation refund reconciliation',
  });

  return (
    split.prepaidPaid <= 0 ||
    (restored.restored >= split.prepaidPaid && restored.savingsRestored)
  );
}
