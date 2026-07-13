import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import {
  PAID_ORDER_FETCH_FAILURE_REASON,
  persistPaidOrderSideEffectRetry,
} from '@/lib/payments/paid-order-retry-persistence';

// Durable pre-push markers for failures that hit AFTER the atomic flip but
// BEFORE push/side effects could run (order fetch, normalization). They keep
// the order visible to the cron drain and tell replays that the merchant
// push is still owed. Never throws — the caller is already failing closed.
export async function persistPrePushRetryMarkers({
  error,
  logMessage,
  orderId,
  reference,
  supabase,
  transactionId,
}: {
  error: unknown;
  logMessage: string;
  orderId: string;
  reference: string;
  supabase: SupabaseClient;
  transactionId: string;
}): Promise<void> {
  logger.error({ error, message: logMessage, orderId });
  try {
    await persistPaidOrderSideEffectRetry({
      error,
      orderId,
      reason: PAID_ORDER_FETCH_FAILURE_REASON,
      reference,
      supabase,
      transaction: { id: transactionId },
    });
  } catch (persistError) {
    logger.error({
      error: persistError,
      message: 'Failed to persist pre-push side-effect retry markers',
      orderId,
    });
  }
}
