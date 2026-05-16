import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { getCheckoutCompletionAuthorizationSecrets } from '@/lib/agentic/checkout-completion-authorization-response';
import { finalizeAgenticCheckoutPayment } from '@/lib/agentic/checkout-completion-finalize';
import {
  getAgenticPaymentState,
  resolveExistingPaymentState,
} from '@/lib/agentic/checkout-completion-response';
import { resolveCheckoutCompletionSessionState } from '@/lib/agentic/checkout-completion-session-state';
import { finalizeAgenticPayOnDeliveryCheckout } from '@/lib/agentic/checkout-pay-on-delivery-finalize';
import { prepareAgenticCheckoutPayment } from '@/lib/agentic/checkout-payment-setup';
import { getAgenticCheckoutSession } from '@/lib/agentic/checkout-session-record';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { getAgenticIdempotencyErrorStatus } from '@/lib/agentic/idempotency-response';
import { buildStoredAgenticIdempotencyResponse } from '@/lib/agentic/idempotency-response-storage';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { getAgenticReplayErrorStatus } from '@/lib/agentic/request-replay-response';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { agenticCheckoutCompleteSchema } from '@/schemas/agentic-checkout';
import { agenticCheckoutSessionRouteParamsSchema } from '@/schemas/agentic-checkout-session-route-params';

const COMPLETE_IDEMPOTENCY_ROUTE = 'checkout_sessions.complete';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedParams =
    agenticCheckoutSessionRouteParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: 'Invalid route params',
        details: parsedParams.error.flatten(),
      },
      { status: 400 }
    );
  }
  const { id: sessionId } = parsedParams.data;

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }

  let respondWithIdempotency:
    | ((response: unknown, status: number) => Promise<NextResponse>)
    | null = null;

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
    const { buyer, completion_authorization, payment_data } = parsed.data;

    const bootstrap = createAdminClient();
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
    respondWithIdempotency = async (response: unknown, status: number) =>
      buildStoredAgenticIdempotencyResponse({
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        requestId: mutation.requestId,
        response,
        route: COMPLETE_IDEMPOTENCY_ROUTE,
        status,
        supabase,
      });
    const replayReservation = await reserveAgenticRequestId({
      apiVersion: mutation.apiVersion,
      idempotencyKey: mutation.idempotencyKey,
      merchantId: merchant.id,
      requestId: mutation.requestId,
      supabase,
    });
    if (!replayReservation.ok) {
      return await respondWithIdempotency(
        { error: replayReservation.error },
        getAgenticReplayErrorStatus(replayReservation.error)
      );
    }
    const storeResponse = respondWithIdempotency;
    if (!storeResponse) {
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
    const respond = async (response: unknown, status: number) =>
      storeResponse(response, status);

    const { data: session, error } = await getAgenticCheckoutSession({
      merchantId: merchant.id,
      sessionId,
      supabase,
    });

    if (error) {
      logger.error({
        message: 'Agentic checkout session read failed',
        error: sanitizeForLog(error),
        sessionId,
      });
      return await respond({ error: 'Database error' }, 500);
    }
    if (!session) return await respond({ error: 'Session not found' }, 404);
    if (session.status === 'completed')
      return await respond({ error: 'Session already completed' }, 409);

    const paymentState = getAgenticPaymentState(session.metadata);
    const existingPaymentState =
      paymentState === 'claiming_payment' ||
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

    const authorizationSecrets = getCheckoutCompletionAuthorizationSecrets();
    const completionState = await resolveCheckoutCompletionSessionState({
      authorizationSecrets,
      completionAuthorization: completion_authorization,
      merchantId: merchant.id,
      session,
      sessionId,
      supabase,
    });
    if (!completionState.ok) {
      return await respond(completionState.body, completionState.status);
    }

    if (payment_data.provider === 'pay_on_delivery') {
      if (merchant.pay_on_delivery_enabled !== true) {
        return await respond(
          { error: 'Pay on delivery is not enabled for this merchant' },
          403
        );
      }

      return await finalizeAgenticPayOnDeliveryCheckout({
        buyer,
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        metadata: completionState.metadata,
        orderSession: session,
        orderSessionCalc: completionState.sessionCalc,
        requestId: mutation.requestId,
        route: COMPLETE_IDEMPOTENCY_ROUTE,
        sessionId,
        supabase,
      });
    }

    const preparedPayment = await prepareAgenticCheckoutPayment({
      authorizationSecrets,
      buyer,
      canResumePaymentAccount: completionState.canResumePaymentAccount,
      completionAuthorization: completion_authorization,
      merchantId: merchant.id,
      metadata: completionState.metadata,
      paystackSubaccountCode: merchant.paystack_subaccount_code,
      session,
      sessionCalc: completionState.sessionCalc,
      sessionId,
      storedDvaAccount: completionState.storedDvaAccount,
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
      sessionId,
      supabase,
    });
  } catch (error: unknown) {
    const body = { error: 'Internal Server Error' };
    logger.error({
      message: 'Agentic checkout complete failed',
      error: sanitizeForLog(error),
      sessionId,
    });
    if (respondWithIdempotency) {
      try {
        return await respondWithIdempotency(body, 500);
      } catch {
        return NextResponse.json(body, { status: 500 });
      }
    }
    return NextResponse.json(body, { status: 500 });
  }
}
