import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { verifyCheckoutCompletionAuthorization } from '@/lib/agentic/checkout-authorization';
import {
  buildAuthorizationErrorBody,
  getAuthorizationErrorStatus,
  getCheckoutCompletionAuthorizationSecrets,
  getCheckoutGrandTotal,
  withCompletionAuthorizationMetadata,
} from '@/lib/agentic/checkout-completion-authorization-response';
import { finalizeAgenticCheckoutPayment } from '@/lib/agentic/checkout-completion-finalize';
import {
  getAgenticPaymentState,
  getStoredDvaAccount,
  resolveExistingPaymentState,
} from '@/lib/agentic/checkout-completion-response';
import { buildPaymentAccountConflictResponse } from '@/lib/agentic/checkout-payment-account-conflict';
import { prepareAgenticCheckoutPayment } from '@/lib/agentic/checkout-payment-setup';
import { getAgenticCheckoutSession } from '@/lib/agentic/checkout-session-record';
import {
  type AgenticMetadata,
  buildAgenticMetadata,
  mapCheckoutSessionStatus,
} from '@/lib/agentic/checkout-storage';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { getAgenticIdempotencyErrorStatus } from '@/lib/agentic/idempotency-response';
import { buildStoredAgenticIdempotencyResponse } from '@/lib/agentic/idempotency-response-storage';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { getAgenticReplayErrorStatus } from '@/lib/agentic/request-replay-response';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import {
  agenticCheckoutCompleteSchema,
  agenticCheckoutItemsSchema,
} from '@/schemas/agentic-checkout';

const COMPLETE_IDEMPOTENCY_ROUTE = 'checkout_sessions.complete';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }

  try {
    const parsed = agenticCheckoutCompleteSchema.safeParse(mutation.body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { buyer, completion_authorization } = parsed.data;

    const bootstrap = createServiceClient();
    const merchant = await resolveAgenticMerchantContext(bootstrap);
    if (!merchant) {
      return NextResponse.json(
        { error: 'Agentic merchant not found' },
        { status: 500 }
      );
    }
    const supabase = createAgenticScopedSupabaseClient({
      merchantId: merchant.id,
      merchantSlug: merchant.slug,
    });
    const idempotency = await reserveAgenticIdempotencyKey({
      apiVersion: mutation.apiVersion,
      body: mutation.rawBody,
      key: mutation.idempotencyKey,
      merchantId: merchant.id,
      method: mutation.method,
      pathname: mutation.pathname,
      route: COMPLETE_IDEMPOTENCY_ROUTE,
      supabase,
    });
    if (!idempotency.ok) {
      return NextResponse.json(
        { error: idempotency.error },
        { status: getAgenticIdempotencyErrorStatus(idempotency.error) }
      );
    }
    if (idempotency.state === 'replay') {
      return NextResponse.json(idempotency.response, {
        status: idempotency.status,
        headers: {
          'idempotency-key': mutation.idempotencyKey,
          'request-id': mutation.requestId,
        },
      });
    }
    const replayReservation = await reserveAgenticRequestId({
      apiVersion: mutation.apiVersion,
      idempotencyKey: mutation.idempotencyKey,
      merchantId: merchant.id,
      requestId: mutation.requestId,
      supabase,
    });
    if (!replayReservation.ok) {
      return NextResponse.json(
        { error: replayReservation.error },
        { status: getAgenticReplayErrorStatus(replayReservation.error) }
      );
    }
    const respond = async (response: unknown, status: number) =>
      buildStoredAgenticIdempotencyResponse({
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        requestId: mutation.requestId,
        response,
        route: COMPLETE_IDEMPOTENCY_ROUTE,
        status,
        supabase,
      });

    const { data: session, error } = await getAgenticCheckoutSession({
      merchantId: merchant.id,
      sessionId: params.id,
      supabase,
    });

    if (error) {
      logger.error({
        message: 'Agentic checkout session read failed',
        error,
        sessionId: params.id,
      });
      return await respond({ error: 'Database error' }, 500);
    }
    if (!session) return await respond({ error: 'Session not found' }, 404);
    if (session.status === 'completed')
      return await respond({ error: 'Session already completed' }, 409);

    const paymentState = getAgenticPaymentState(session.metadata);
    const existingPaymentState =
      paymentState === 'payment_account_ready' ||
      paymentState === 'order_finalizing'
        ? null
        : resolveExistingPaymentState({ buyer, session });
    if (existingPaymentState) {
      return await respond(
        existingPaymentState.body,
        existingPaymentState.status
      );
    }

    const parsedCartItems = agenticCheckoutItemsSchema.safeParse(
      session.cart_items
    );
    if (!parsedCartItems.success) {
      logger.error({
        message: 'Agentic checkout session has invalid cart items',
        error: parsedCartItems.error.flatten(),
        sessionId: params.id,
      });
      return await respond({ error: 'Invalid session cart items' }, 500);
    }

    let sessionCalc: Awaited<ReturnType<typeof calculateCheckoutSession>>;
    try {
      sessionCalc = await calculateCheckoutSession(
        supabase,
        parsedCartItems.data,
        session.shipping_method,
        session.currency,
        merchant.id
      );
    } catch (error) {
      logger.error({
        message: 'Agentic checkout calculation failed',
        error,
        sessionId: params.id,
      });
      return await respond({ error: 'Checkout calculation failed' }, 500);
    }
    const calculationErrors = sessionCalc.messages.filter(
      (message) => message.type === 'error'
    );
    if (calculationErrors.length > 0) {
      return await respond(
        {
          error: 'Checkout calculation has errors',
          messages: calculationErrors,
        },
        409
      );
    }
    const storedDvaAccount = getStoredDvaAccount(session);
    const canResumePaymentAccount =
      paymentState === 'payment_account_ready' &&
      !!storedDvaAccount &&
      !session.order_id;
    if (!canResumePaymentAccount && paymentState === 'payment_account_ready') {
      return await respond(
        buildPaymentAccountConflictResponse({ orderId: session.order_id }),
        409
      );
    }

    const grandTotal = getCheckoutGrandTotal(sessionCalc.totals);

    if (!Number.isFinite(grandTotal))
      return await respond({ error: 'Could not calculate total' }, 500);

    const status = mapCheckoutSessionStatus({
      status: session.status,
      hasFulfillmentAddress: !!session.shipping_address,
      hasLineItems: sessionCalc.lineItems.length > 0,
    });
    if (status !== 'ready_for_payment') {
      return await respond(
        {
          error: 'Session is not ready for payment',
          status,
        },
        409
      );
    }

    const authorization = verifyCheckoutCompletionAuthorization({
      amount: grandTotal,
      authorization: completion_authorization,
      currency: session.currency,
      secrets: getCheckoutCompletionAuthorizationSecrets(),
      sessionId: session.session_id,
    });
    if (!authorization.ok) {
      return await respond(
        buildAuthorizationErrorBody(authorization.code),
        getAuthorizationErrorStatus(authorization.code)
      );
    }

    const metadata = withCompletionAuthorizationMetadata(
      buildAgenticMetadata({
        existingMetadata: session.metadata as AgenticMetadata | null,
        lineItems: sessionCalc.lineItems,
        totals: sessionCalc.totals,
        fulfillmentOptions: sessionCalc.fulfillmentOptions,
        messages: [],
      }),
      authorization.mode
    );
    const preparedPayment = await prepareAgenticCheckoutPayment({
      authorizationSecrets: getCheckoutCompletionAuthorizationSecrets(),
      buyer,
      canResumePaymentAccount,
      completionAuthorization: completion_authorization,
      merchantId: merchant.id,
      metadata,
      paystackSubaccountCode: merchant.paystack_subaccount_code,
      session,
      sessionCalc,
      sessionId: params.id,
      storedDvaAccount,
      supabase,
    });
    if (!preparedPayment.ok) {
      return await respond(preparedPayment.body, preparedPayment.status);
    }

    return await finalizeAgenticCheckoutPayment({
      buyer,
      dvaAccount: preparedPayment.payment.dvaAccount,
      idempotencyKey: mutation.idempotencyKey,
      merchantId: merchant.id,
      metadata: preparedPayment.payment.metadata,
      orderSession: preparedPayment.payment.session,
      orderSessionCalc: preparedPayment.payment.sessionCalc,
      requestId: mutation.requestId,
      route: COMPLETE_IDEMPOTENCY_ROUTE,
      sessionId: params.id,
      supabase,
    });
  } catch (error: unknown) {
    logger.error({
      message: 'Agentic checkout complete failed',
      error,
      sessionId: params.id,
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
