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
  compensateCreatedOrderAfterFinalizationFailure,
  releaseFinalizationClaimSafely,
} from '@/lib/agentic/checkout-finalization-compensation';
import {
  createAgenticCheckoutOrder,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import {
  buildOrderFinalizationClaim,
  claimAgenticOrderFinalization,
  recordAgenticOrderFinalizationOrderCreated,
} from '@/lib/agentic/checkout-order-finalization-claim';
import type { AgenticMetadata } from '@/lib/agentic/checkout-storage';
import { buildStoredAgenticIdempotencyResponse } from '@/lib/agentic/idempotency-response-storage';
import {
  revalidateProductSlugs,
  revalidateProducts,
} from '@/lib/cache-revalidation';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

type CheckoutCalculation = Awaited<ReturnType<typeof calculateCheckoutSession>>;

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

  let orderId = getMarkedFinalizationOrderId(metadata);
  if (!orderId) {
    const orderPayload = buildAgenticCheckoutOrderPayload({
      buyer,
      dvaAccount,
      session: orderSession,
      sessionCalc: orderSessionCalc,
    });
    let orderResult: Awaited<ReturnType<typeof createAgenticCheckoutOrder>>;
    try {
      orderResult = await createAgenticCheckoutOrder(orderPayload, supabase);
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

    const createdOrderId = orderResult.orderId;
    if (!createdOrderId) {
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
    orderId = createdOrderId;

    // Stock was decremented inside create_storefront_order (via
    // createAgenticCheckoutOrder). Bust the merchant's product caches so the
    // storefront reflects it immediately. Only runs on the new-order branch.
    try {
      revalidateProducts(merchantId);

      // revalidateProducts(merchantId) busts only the merchant-wide/listing
      // tags — NOT the per-slug tag getCachedProduct() uses (the PDP's primary
      // data source), so a just-sold-out product can keep rendering in-stock on
      // its own PDP for the full 'products' cacheLife TTL. orderSessionCalc
      // .lineItems carries only product_id (never slug), and item.product_id is
      // always the PARENT product id (plain or variant line), so resolve slugs
      // with one merchant-scoped, PK-indexed lookup and bust their PDP tags too.
      const productIds = Array.from(
        new Set(
          orderSessionCalc.lineItems
            .map((li) => li.item.product_id)
            .filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            )
        )
      );
      if (productIds.length > 0) {
        const { data: productsForRevalidate, error: slugLookupError } =
          await supabase
            .from('products')
            .select('slug')
            .in('id', productIds)
            .eq('merchant_id', merchantId)
            .returns<Array<{ slug: string }>>();
        if (slugLookupError) {
          logger.error({
            error: sanitizeForLog(slugLookupError),
            message: 'Failed to load product slugs for PDP cache revalidation',
            sessionId: sanitizeForLog(sessionId),
          });
        } else {
          revalidateProductSlugs(
            merchantId,
            (productsForRevalidate ?? []).map((p) => p.slug)
          );
        }
      }
    } catch (revalidateError) {
      logger.error({
        error: sanitizeForLog(revalidateError),
        message:
          'Failed to revalidate product caches after agentic order creation',
        sessionId: sanitizeForLog(sessionId),
      });
    }

    const marker = await recordAgenticOrderFinalizationOrderCreated({
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
          marker.error ?? 'Order finalization marker failed'
        ),
        message: 'Agentic order finalization marker failed',
        orderId: sanitizeForLog(orderId),
        sessionId: sanitizeForLog(sessionId),
      });
      await compensateCreatedOrderAfterFinalizationFailure({
        finalizationClaim,
        merchantId,
        metadata,
        orderError: marker.error ?? 'Order finalization marker failed',
        orderId,
        sessionId,
        supabase,
      });
      return respond({ error: 'Database error' }, 500);
    }
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
    logger.error({
      error: sanitizeForLog(updateError ?? 'No checkout session row updated'),
      message: 'Agentic checkout session payment state update failed',
      orderId: sanitizeForLog(orderId),
      sessionId: sanitizeForLog(sessionId),
    });
    await compensateCreatedOrderAfterFinalizationFailure({
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

function getMarkedFinalizationOrderId(
  metadata: AgenticMetadata
): string | null {
  const orderId = metadata.agentic?.finalization_order_id;
  return typeof orderId === 'string' && orderId.trim().length > 0
    ? orderId.trim()
    : null;
}
