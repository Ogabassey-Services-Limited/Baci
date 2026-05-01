import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  calculateCheckoutSession,
  GPTTotal,
} from '@/lib/agentic/checkout';
import {
  buildAgenticCheckoutOrderPayload,
  buildPaymentPendingSessionUpdate,
} from '@/lib/agentic/checkout-completion-payloads';
import {
  type AgenticCheckoutBuyer,
  buildPaymentPendingCheckoutResponse,
  type StoredDvaAccount,
} from '@/lib/agentic/checkout-completion-response';
import {
  createAgenticCheckoutOrder,
  markAgenticCheckoutOrderCanceled,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import {
  buildOrderFinalizationClaim,
  claimAgenticOrderFinalization,
  releaseAgenticOrderFinalizationClaim,
} from '@/lib/agentic/checkout-order-finalization-claim';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { buildStoredAgenticIdempotencyResponse } from '@/lib/agentic/idempotency-response-storage';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

type CheckoutCalculation = Awaited<ReturnType<typeof calculateCheckoutSession>>;

async function releaseFinalizationClaimSafely({
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

export async function finalizeAgenticCheckoutPayment({
  buyer,
  dvaAccount,
  idempotencyKey,
  merchantId,
  metadata,
  orderSession,
  orderSessionCalc,
  requestId,
  route,
  sessionId,
  supabase,
}: {
  buyer: AgenticCheckoutBuyer;
  dvaAccount: StoredDvaAccount;
  idempotencyKey: string;
  merchantId: string;
  metadata: AgenticMetadata;
  orderSession: {
    currency: string;
    merchant_id: string;
    session_id: string;
    shipping_address?: unknown;
  };
  orderSessionCalc: CheckoutCalculation;
  requestId: string;
  route: string;
  sessionId: string;
  supabase: SupabaseClient;
}) {
  const finalizationClaim = buildOrderFinalizationClaim({
    idempotencyKey,
    requestId,
    sessionId,
  });
  const respond = (response: unknown, status: number) =>
    buildStoredAgenticIdempotencyResponse({
      idempotencyKey,
      merchantId,
      requestId,
      response,
      route,
      status,
      supabase,
    });
  const claim = await claimAgenticOrderFinalization({
    buyer,
    dvaAccount,
    finalizationClaim,
    merchantId,
    metadata,
    sessionId,
    supabase,
  });
  if (claim.error) {
    logger.error({
      error: sanitizeForLog(claim.error),
      message: 'Agentic checkout order finalization claim write failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Database error' }, 500);
  }
  if (!claim.claimed) {
    logger.warn({
      message: 'Agentic checkout order finalization claim failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond(
      {
        error: 'Session finalization already in progress',
        status: 'payment_pending',
      },
      409
    );
  }

  const orderPayload = buildAgenticCheckoutOrderPayload({
    buyer,
    dvaAccount,
    session: orderSession,
    sessionCalc: orderSessionCalc,
  });
  let orderResult: Awaited<ReturnType<typeof createAgenticCheckoutOrder>>;
  try {
    orderResult = await createAgenticCheckoutOrder(orderPayload);
  } catch (error) {
    await releaseFinalizationClaimSafely({
      finalizationClaim,
      merchantId,
      metadata,
      orderError: error,
      sessionId,
      supabase,
    });
    logger.error({
      error: sanitizeForLog(error),
      message: 'Order creation threw',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Order creation failed' }, 500);
  }

  if (!orderResult.ok) {
    await releaseFinalizationClaimSafely({
      finalizationClaim,
      merchantId,
      metadata,
      orderError: orderResult.error ?? orderResult.statusText,
      sessionId,
      supabase,
    });
    logger.error({
      error: sanitizeForLog(orderResult.error ?? orderResult.statusText),
      message: 'Order creation failed',
      sessionId: sanitizeForLog(sessionId),
      status: orderResult.status,
      statusText: orderResult.statusText,
    });
    return respond({ error: 'Order creation failed' }, 500);
  }

  const orderId = orderResult.orderId;
  if (!orderId) {
    await releaseFinalizationClaimSafely({
      finalizationClaim,
      merchantId,
      metadata,
      orderError: 'Missing order id',
      sessionId,
      supabase,
    });
    logger.error({
      message: 'Order creation response omitted order id',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Order creation failed' }, 500);
  }

  const updatePayload = buildPaymentPendingSessionUpdate({
    buyer,
    dvaAccount,
    metadata,
    orderId,
  });
  const { data: updatedSession, error: updateError } = await supabase
    .from('checkout_sessions')
    .update(updatePayload)
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', dvaAccount.account_number)
    .is('order_id', null)
    .in('status', ['pending', 'processing'])
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_state: 'order_finalizing',
      },
    })
    .select('session_id')
    .maybeSingle();

  if (updateError || !updatedSession) {
    const cancellation = await markAgenticCheckoutOrderCanceled({
      merchantId,
      orderId,
      sessionId,
      supabase,
    });
    const cancellationSucceeded = !cancellation.error && cancellation.updated;
    let releaseError: unknown = null;
    if (cancellationSucceeded) {
      releaseError = await releaseFinalizationClaimSafely({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: updateError ?? 'No checkout session row updated',
        sessionId,
        supabase,
      });
    }
    logger.error({
      error: {
        cancellationError: cancellation.error
          ? sanitizeForLog(cancellation.error)
          : null,
        cancellationUpdated: cancellation.updated,
        releaseError: releaseError ? sanitizeForLog(releaseError) : null,
        releaseSkipped: !cancellationSucceeded,
        updateError: updateError ? sanitizeForLog(updateError) : null,
      },
      message: 'Checkout session payment state update failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Database error' }, 500);
  }

  sendAgenticOrderCreatedWebhook({
    buyer,
    currency: orderSession.currency,
    orderId,
    sessionId,
    total:
      orderSessionCalc.totals.find((t: GPTTotal) => t.type === 'total')
        ?.amount ?? 0,
  });

  const responsePayload = buildPaymentPendingCheckoutResponse({
    buyer,
    dvaAccount,
    orderId,
    session: orderSession,
    sessionCalc: orderSessionCalc,
  });
  return respond(responsePayload, 200);
}
