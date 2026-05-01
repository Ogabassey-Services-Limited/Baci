import type { SupabaseClient } from '@supabase/supabase-js';
import { markAgenticCheckoutOrderCanceled } from '@/lib/agentic/checkout-order-dispatch';
import { releaseAgenticOrderFinalizationClaim } from '@/lib/agentic/checkout-order-finalization-claim';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

export async function releaseFinalizationClaimSafely({
  finalizationClaim,
  merchantId,
  metadata,
  orderError,
  sessionId,
  supabase,
}: {
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  orderError: unknown;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  try {
    await releaseAgenticOrderFinalizationClaim({
      finalizationClaim,
      merchantId,
      metadata,
      orderError,
      sessionId,
      supabase,
    });
    return null;
  } catch (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Agentic checkout order finalization claim release threw',
      sessionId: sanitizeForLog(sessionId),
    });
    return error;
  }
}

export async function compensateCreatedOrderAfterFinalizationFailure({
  finalizationClaim,
  merchantId,
  metadata,
  orderError,
  orderId,
  sessionId,
  supabase,
}: {
  finalizationClaim: string;
  merchantId: string;
  metadata: AgenticMetadata;
  orderError: unknown;
  orderId: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  let cancellationError: unknown = null;
  let cancellationUpdated = false;
  try {
    const cancellation = await markAgenticCheckoutOrderCanceled({
      merchantId,
      orderId,
      sessionId,
      supabase,
    });
    cancellationError = cancellation.error;
    cancellationUpdated = cancellation.updated;
  } catch (error) {
    cancellationError = error;
  }
  if (!cancellationError) {
    try {
      await releaseAgenticOrderFinalizationClaim({
        finalizationClaim,
        merchantId,
        metadata,
        orderError,
        sessionId,
        supabase,
      });
    } catch (error) {
      logger.error({
        error: sanitizeForLog(error),
        finalizationClaim: sanitizeForLog(finalizationClaim),
        merchantId: sanitizeForLog(merchantId),
        message:
          'Agentic order finalization claim release failed after compensation',
        sessionId: sanitizeForLog(sessionId),
      });
    }
  }
  logger.error({
    error: {
      cancellationError: cancellationError
        ? sanitizeForLog(cancellationError)
        : null,
      cancellationUpdated,
      orderError: sanitizeForLog(orderError),
    },
    message: 'Checkout session payment state update failed',
    sessionId: sanitizeForLog(sessionId),
  });
}
