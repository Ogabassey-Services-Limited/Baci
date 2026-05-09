import type { SupabaseClient } from '@supabase/supabase-js';
import { markAgenticCheckoutOrderCanceled } from '@/lib/agentic/checkout-order-dispatch';
import { releasePayOnDeliveryFinalizationClaim } from '@/lib/agentic/checkout-pay-on-delivery-claim';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

export async function releasePayOnDeliveryClaimSafely({
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
    await releasePayOnDeliveryFinalizationClaim({
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
      message: 'Pay-on-delivery finalization claim release threw',
      sessionId: sanitizeForLog(sessionId),
    });
  }
}

export async function compensatePayOnDeliveryFinalizationFailure({
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
    await releasePayOnDeliveryClaimSafely({
      finalizationClaim,
      merchantId,
      metadata,
      orderError,
      sessionId,
      supabase,
    });
  }

  logger.error({
    error: {
      cancellationError: cancellationError
        ? sanitizeForLog(cancellationError)
        : null,
      cancellationUpdated,
      orderError: sanitizeForLog(orderError),
    },
    message: 'Pay-on-delivery finalization failed after order creation',
    orderId: sanitizeForLog(orderId),
    sessionId: sanitizeForLog(sessionId),
  });
}
