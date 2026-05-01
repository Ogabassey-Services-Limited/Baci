import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';
import {
  buildCheckoutSessionInsert,
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
import { buildStoreUrl } from '@/lib/store-url';
import { createServiceClient } from '@/lib/supabase/service';
import { checkoutSessionSchema } from '@/schemas/agentic-checkout';

const CREATE_IDEMPOTENCY_ROUTE = 'checkout_sessions.create';

export async function POST(request: NextRequest) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }

  let respondWithIdempotency:
    | ((
        response: unknown,
        status: number,
        storageFailureResponse?: Record<string, unknown>
      ) => Promise<NextResponse>)
    | null = null;

  try {
    const parsed = checkoutSessionSchema.safeParse(mutation.body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { items, shipping_address, currency } = parsed.data;

    // 2. Calculate Cart State
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
      route: CREATE_IDEMPOTENCY_ROUTE,
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
    respondWithIdempotency = (
      response: unknown,
      status: number,
      storageFailureResponse?: Record<string, unknown>
    ): Promise<NextResponse> =>
      buildStoredAgenticIdempotencyResponse({
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        requestId: mutation.requestId,
        response,
        route: CREATE_IDEMPOTENCY_ROUTE,
        status,
        storageFailureResponse,
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

    const respond = (
      response: unknown,
      status: number,
      storageFailureResponse?: Record<string, unknown>
    ): Promise<NextResponse> =>
      respondWithIdempotency?.(response, status, storageFailureResponse) ??
      buildStoredAgenticIdempotencyResponse({
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        requestId: mutation.requestId,
        response,
        route: CREATE_IDEMPOTENCY_ROUTE,
        status,
        storageFailureResponse,
        supabase,
      });

    let sessionCalc: Awaited<ReturnType<typeof calculateCheckoutSession>>;
    try {
      sessionCalc = await calculateCheckoutSession(
        supabase,
        items,
        null,
        currency,
        merchant.id
      );
    } catch (error) {
      logger.error({
        message: 'Agentic checkout session calculation failed',
        error,
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
      });
      return await respond({ error: 'Checkout calculation failed' }, 500);
    }

    // 3. Create Session in DB
    const sessionId = `agentic_${randomUUID()}`;
    const fulfillmentOptionId = sessionCalc.selectedOptionId ?? null;
    const insertPayload = buildCheckoutSessionInsert({
      sessionId,
      merchantId: merchant.id,
      items,
      currency,
      fulfillmentAddress: shipping_address ?? null,
      fulfillmentOptionId,
      lineItems: sessionCalc.lineItems,
      fulfillmentOptions: sessionCalc.fulfillmentOptions,
      totals: sessionCalc.totals,
      messages: sessionCalc.messages,
    });

    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .insert(insertPayload)
      .select('id, session_id')
      .single();

    if (error) {
      logger.error({
        message: 'Failed to create agentic checkout session',
        error,
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
      });
      return await respond({ error: 'Database error' }, 500);
    }

    // 4. Response
    const status = mapCheckoutSessionStatus({
      status: insertPayload.status,
      hasFulfillmentAddress: !!shipping_address,
      hasLineItems: sessionCalc.lineItems.length > 0,
    });
    const responseSessionId = session.session_id ?? sessionId;
    const responsePayload = buildCheckoutSessionStateResponse({
      currency,
      fulfillmentOptionId,
      fulfillmentOptions: sessionCalc.fulfillmentOptions,
      lineItems: sessionCalc.lineItems,
      messages: sessionCalc.messages,
      policyBaseUrl: buildStoreUrl(merchant),
      sessionId: responseSessionId,
      shippingAddress: shipping_address ?? null,
      status,
      totals: sessionCalc.totals,
    });

    return await respond(responsePayload, 201, {
      error: 'Idempotency response storage failed',
      idempotency_key: mutation.idempotencyKey,
      recovery_action: 'read_checkout_session',
      session_id: responseSessionId,
    });
  } catch (err) {
    const body = { error: 'Internal Server Error' };
    logger.error({
      message: 'Agentic checkout session create error',
      error: err,
      idempotencyKey: mutation.idempotencyKey,
      requestId: mutation.requestId,
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
