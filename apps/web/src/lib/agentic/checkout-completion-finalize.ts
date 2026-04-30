import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
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
import { storeAgenticIdempotencyResponse } from '@/lib/agentic/idempotency';
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
  const claim = await claimAgenticOrderFinalization({
    buyer,
    dvaAccount,
    finalizationClaim,
    merchantId,
    metadata,
    sessionId,
    supabase,
  });
  if (!claim.claimed) {
    logger.warn({
      error: claim.error,
      message: 'Agentic checkout order finalization claim failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return NextResponse.json(
      {
        error: 'Session finalization already in progress',
        status: 'payment_pending',
      },
      { status: 409 }
    );
  }

  const orderPayload = buildAgenticCheckoutOrderPayload({
    buyer,
    dvaAccount,
    session: orderSession,
    sessionCalc: orderSessionCalc,
  });
  const orderResult = await createAgenticCheckoutOrder(orderPayload);

  if (!orderResult.ok) {
    await releaseAgenticOrderFinalizationClaim({
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
    return NextResponse.json(
      { error: 'Order creation failed' },
      { status: 500 }
    );
  }

  const orderId = orderResult.orderId;
  if (!orderId) {
    await releaseAgenticOrderFinalizationClaim({
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
    return NextResponse.json(
      { error: 'Order creation failed' },
      { status: 500 }
    );
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
    logger.error({
      error: { cancellationError: cancellation.error, updateError },
      message: 'Checkout session payment state update failed',
      sessionId: sanitizeForLog(sessionId),
    });
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
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
  await storeAgenticIdempotencyResponse({
    key: idempotencyKey,
    merchantId,
    response: responsePayload,
    route,
    status: 200,
    supabase,
  });

  return NextResponse.json(responsePayload, {
    headers: {
      'idempotency-key': idempotencyKey,
      'request-id': requestId,
    },
  });
}
