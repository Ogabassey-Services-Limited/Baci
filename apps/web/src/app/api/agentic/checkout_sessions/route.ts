import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';
import {
  buildCheckoutSessionInsert,
  mapCheckoutSessionStatus,
} from '@/lib/agentic/checkout-storage';
import {
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
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
        { status: replayReservation.error === 'Replay request id' ? 409 : 503 }
      );
    }

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
        { status: idempotency.error === 'Idempotency conflict' ? 409 : 425 }
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

    const sessionCalc = await calculateCheckoutSession(
      supabase,
      items,
      null,
      currency,
      merchant.id
    );

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
      console.error('Failed to create checkout session:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
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

    const idempotencyStore = await storeAgenticIdempotencyResponse({
      key: mutation.idempotencyKey,
      merchantId: merchant.id,
      response: responsePayload,
      route: CREATE_IDEMPOTENCY_ROUTE,
      status: 201,
      supabase,
    });
    if (!idempotencyStore.ok) {
      console.error('Failed to store agentic checkout idempotency response:', {
        error: idempotencyStore.error,
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        route: CREATE_IDEMPOTENCY_ROUTE,
        sessionId: responseSessionId,
      });
      return NextResponse.json(
        {
          error: 'Idempotency response storage failed',
          idempotency_key: mutation.idempotencyKey,
          recovery_action: 'read_checkout_session',
          session_id: responseSessionId,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        'idempotency-key': mutation.idempotencyKey,
        'request-id': mutation.requestId,
      },
    });
  } catch (err) {
    console.error('Agentic Checkout Create Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
