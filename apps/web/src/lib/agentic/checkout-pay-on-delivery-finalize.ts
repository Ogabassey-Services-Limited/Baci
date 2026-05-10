import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY } from '@/config/agentic-payment-methods';
import type { calculateCheckoutSession } from '@/lib/agentic/checkout';
import type { AgenticCheckoutBuyer } from '@/lib/agentic/checkout-completion-response';
import {
  createAgenticCheckoutOrder,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import { buildOrderFinalizationClaim } from '@/lib/agentic/checkout-order-finalization-claim';
import {
  claimPayOnDeliveryFinalization,
  getMarkedPayOnDeliveryFinalizationOrderId,
  recordPayOnDeliveryOrderCreated,
} from '@/lib/agentic/checkout-pay-on-delivery-claim';
import {
  compensatePayOnDeliveryFinalizationFailure,
  releasePayOnDeliveryClaimSafely,
} from '@/lib/agentic/checkout-pay-on-delivery-compensation';
import {
  buildPayOnDeliveryCheckoutResponse,
  buildPayOnDeliveryCompletedSessionUpdate,
  buildPayOnDeliveryOrderPayload,
} from '@/lib/agentic/checkout-pay-on-delivery-payloads';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import {
  buildPersistedAgenticIdempotencyResponse,
  buildStoredAgenticIdempotencyResponse,
  persistAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency-response-storage';
// `buildStoredAgenticIdempotencyResponse` is still used for error paths via
// the `respond` helper; the success path persists separately so the response
// row is durable BEFORE the session.status flip to 'completed'.
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

type CheckoutCalculation = Awaited<ReturnType<typeof calculateCheckoutSession>>;

export async function finalizeAgenticPayOnDeliveryCheckout({
  buyer,
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

  const claim = await claimPayOnDeliveryFinalization({
    buyer,
    finalizationClaim,
    merchantId,
    metadata,
    sessionId,
    supabase,
  });
  if (claim.error) {
    logger.error({
      error: sanitizeForLog(claim.error),
      message: 'Pay-on-delivery finalization claim failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Database error' }, 500);
  }
  if (!claim.claimed) {
    return respond(
      {
        error: 'Session finalization already in progress',
        status: 'payment_pending',
      },
      409
    );
  }

  let orderId = getMarkedPayOnDeliveryFinalizationOrderId(metadata);
  if (!orderId) {
    const orderPayload = buildPayOnDeliveryOrderPayload({
      buyer,
      session: orderSession,
      sessionCalc: orderSessionCalc,
    });
    let orderResult: Awaited<ReturnType<typeof createAgenticCheckoutOrder>>;
    try {
      orderResult = await createAgenticCheckoutOrder(orderPayload, supabase);
    } catch (error) {
      await releasePayOnDeliveryClaimSafely({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: error,
        sessionId,
        supabase,
      });
      logger.error({
        error: sanitizeForLog(error),
        message: 'Pay-on-delivery order creation threw',
        sessionId: sanitizeForLog(sessionId),
      });
      return respond({ error: 'Order creation failed' }, 500);
    }

    if (!orderResult.ok) {
      await releasePayOnDeliveryClaimSafely({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: orderResult.error ?? orderResult.statusText,
        sessionId,
        supabase,
      });
      logger.error({
        error: sanitizeForLog(orderResult.error ?? orderResult.statusText),
        message: 'Pay-on-delivery order creation failed',
        sessionId: sanitizeForLog(sessionId),
      });
      return respond({ error: 'Order creation failed' }, 500);
    }

    const createdOrderId = orderResult.orderId;
    if (!createdOrderId) {
      await releasePayOnDeliveryClaimSafely({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: 'Missing order id',
        sessionId,
        supabase,
      });
      logger.error({
        message: 'Pay-on-delivery order creation response omitted order id',
        sessionId: sanitizeForLog(sessionId),
      });
      return respond({ error: 'Order creation failed' }, 500);
    }
    orderId = createdOrderId;

    const marker = await recordPayOnDeliveryOrderCreated({
      finalizationClaim,
      merchantId,
      metadata,
      orderId,
      sessionId,
      supabase,
    });
    if (!marker.recorded) {
      logger.error({
        error: sanitizeForLog(
          marker.error ?? 'No checkout session row updated'
        ),
        message: 'Pay-on-delivery order finalization marker failed',
        orderId: sanitizeForLog(orderId),
        sessionId: sanitizeForLog(sessionId),
      });
      await compensatePayOnDeliveryFinalizationFailure({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: marker.error ?? 'No checkout session row updated',
        orderId,
        sessionId,
        supabase,
      });
      return respond({ error: 'Database error' }, 500);
    }
  }

  // Build the success response body in-memory first so we can persist it as
  // the idempotency record BEFORE flipping the session to 'completed'. If
  // persistence fails after the status flip, retries hit the
  // session.status === 'completed' early-conflict path in route.ts and the
  // client can never recover the order details for an order that was created.
  const successResponse = buildPayOnDeliveryCheckoutResponse({
    buyer,
    orderId,
    session: orderSession,
    sessionCalc: orderSessionCalc,
  });

  const persisted = await persistAgenticIdempotencyResponse({
    idempotencyKey,
    merchantId,
    requestId,
    response: successResponse,
    route,
    status: 200,
    supabase,
  });
  if (!persisted.ok) {
    // The order was created and finalization_order_id is durable in metadata;
    // the session is still in 'order_finalizing'. Do NOT release the claim or
    // cancel the order — a retry will resume via the marked finalization
    // order id and attempt persistence again. Returning 503 mirrors the
    // existing storage-failure contract from buildStoredAgenticIdempotencyResponse.
    logger.error({
      error: sanitizeForLog(persisted.error),
      message:
        'Pay-on-delivery idempotency persistence failed before status flip; leaving session in order_finalizing for retry resume',
      orderId: sanitizeForLog(orderId),
      sessionId: sanitizeForLog(sessionId),
    });
    return respond({ error: 'Idempotency response storage failed' }, 503);
  }

  const updatePayload = buildPayOnDeliveryCompletedSessionUpdate({
    buyer,
    metadata,
    orderId,
  });
  const { data: updatedSession, error: updateError } = await supabase
    .from('checkout_sessions')
    .update(updatePayload)
    .eq('session_id', sessionId)
    .eq('merchant_id', merchantId)
    .eq('payment_reference', finalizationClaim)
    .is('order_id', null)
    .contains('metadata', {
      agentic: {
        finalization_claim: finalizationClaim,
        payment_method: AGENTIC_PAYMENT_METHOD_PAY_ON_DELIVERY,
        payment_state: 'order_finalizing',
      },
    })
    .select('session_id')
    .maybeSingle();

  if (updateError || !updatedSession) {
    logger.error({
      error: sanitizeForLog(updateError ?? 'No checkout session row updated'),
      message: 'Pay-on-delivery checkout session completion failed',
      orderId: sanitizeForLog(orderId),
      sessionId: sanitizeForLog(sessionId),
    });
    await compensatePayOnDeliveryFinalizationFailure({
      finalizationClaim,
      merchantId,
      metadata,
      orderError: updateError ?? 'No checkout session row updated',
      orderId,
      sessionId,
      supabase,
    });
    return respond({ error: 'Database error' }, 500);
  }

  const total = orderSessionCalc.totals.find(
    (candidate) => candidate.type === 'total'
  );
  if (!total) {
    logger.warn({
      message: 'Pay-on-delivery checkout response is missing total',
      orderId: sanitizeForLog(orderId),
      sessionId: sanitizeForLog(sessionId),
    });
  }

  sendAgenticOrderCreatedWebhook({
    buyer,
    currency: orderSession.currency,
    orderId,
    sessionId,
    total: total?.amount,
  });

  // Idempotency record was already persisted above; just build the response
  // shell here without re-persisting (the row is identical).
  return buildPersistedAgenticIdempotencyResponse({
    idempotencyKey,
    merchantId,
    requestId,
    response: successResponse,
    route,
    status: 200,
  });
}
