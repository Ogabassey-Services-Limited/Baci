import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import {
  hasCheckoutPaymentSideEffect,
  resolveExistingPaymentState,
} from '@/lib/agentic/checkout-completion-response';
import {
  getAgenticCheckoutSession,
  MUTABLE_CHECKOUT_SESSION_STATUSES,
} from '@/lib/agentic/checkout-session-record';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';
import {
  buildCheckoutSessionUpdate,
  mapCheckoutSessionStatus,
} from '@/lib/agentic/checkout-storage';
import {
  reserveAgenticIdempotencyKey,
  storeAgenticIdempotencyResponse,
} from '@/lib/agentic/idempotency';
import { getAgenticIdempotencyErrorStatus } from '@/lib/agentic/idempotency-response';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { getAgenticReplayErrorStatus } from '@/lib/agentic/request-replay-response';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { buildStoreUrl } from '@/lib/store-url';
import { createServiceClient } from '@/lib/supabase/service';
import {
  agenticCheckoutItemsSchema,
  agenticCheckoutUpdateSchema,
} from '@/schemas/agentic-checkout';

const UPDATE_IDEMPOTENCY_ROUTE = 'checkout_sessions.update';
type SessionRouteProps = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, props: SessionRouteProps) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const signedRead = await readAgenticMutationRequest({
    request,
    requireIdempotency: false,
  });
  if (!signedRead.ok) return signedRead.response;
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
  const { data: session, error } = await getAgenticCheckoutSession({
    merchantId: merchant.id,
    sessionId: params.id,
    supabase,
  });
  if (error) {
    console.error('Failed to fetch checkout session:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
  if (!session)
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const existingPaymentState = resolveExistingPaymentState({ session });
  if (existingPaymentState) {
    return NextResponse.json(existingPaymentState.body, {
      status: existingPaymentState.status,
    });
  }
  const parsedCartItems = agenticCheckoutItemsSchema.safeParse(
    session.cart_items
  );
  if (!parsedCartItems.success) {
    return NextResponse.json(
      { error: 'Invalid session cart items' },
      { status: 500 }
    );
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
  } catch {
    return NextResponse.json(
      { error: 'Checkout calculation failed' },
      { status: 500 }
    );
  }
  const paymentState = resolveExistingPaymentState({ session, sessionCalc });
  if (paymentState)
    return NextResponse.json(paymentState.body, {
      status: paymentState.status,
    });
  const status = mapCheckoutSessionStatus({
    status: session.status,
    hasFulfillmentAddress: !!session.shipping_address,
    hasLineItems: sessionCalc.lineItems.length > 0,
  });
  return NextResponse.json(
    buildCheckoutSessionStateResponse({
      currency: session.currency,
      fulfillmentOptionId: session.shipping_method,
      fulfillmentOptions: sessionCalc.fulfillmentOptions,
      lineItems: sessionCalc.lineItems,
      messages: sessionCalc.messages,
      policyBaseUrl: buildStoreUrl(merchant),
      sessionId: session.session_id,
      shippingAddress: session.shipping_address,
      status,
      totals: sessionCalc.totals,
    })
  );
}

export async function POST(request: NextRequest, props: SessionRouteProps) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }
  try {
    const parsed = agenticCheckoutUpdateSchema.safeParse(mutation.body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const { items, shipping_address, fulfillment_option_id } = parsed.data;
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
      route: UPDATE_IDEMPOTENCY_ROUTE,
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
    const { data: session, error } = await getAgenticCheckoutSession({
      merchantId: merchant.id,
      sessionId: params.id,
      supabase,
    });
    if (error) {
      console.error('Failed to fetch checkout session:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (!MUTABLE_CHECKOUT_SESSION_STATUSES.includes(session.status)) {
      return NextResponse.json(
        {
          error: 'Session cannot be updated',
          status: mapCheckoutSessionStatus({
            status: session.status,
            hasFulfillmentAddress: !!session.shipping_address,
            hasLineItems: session.cart_items.length > 0,
          }),
        },
        { status: 409 }
      );
    }
    if (hasCheckoutPaymentSideEffect(session)) {
      return NextResponse.json(
        {
          error: 'Session already has pending payment',
          status: 'payment_pending',
        },
        { status: 409 }
      );
    }
    const newItems = items ?? session.cart_items;
    const newAddress =
      shipping_address !== undefined
        ? shipping_address
        : session.shipping_address;
    const newOptionId =
      fulfillment_option_id !== undefined
        ? fulfillment_option_id
        : session.shipping_method;
    const sessionCalc = await calculateCheckoutSession(
      supabase,
      newItems,
      newOptionId,
      session.currency,
      merchant.id
    );
    const selectedOptionId =
      newOptionId ?? sessionCalc.selectedOptionId ?? null;
    const updatePayload = buildCheckoutSessionUpdate({
      items: newItems,
      currency: session.currency,
      fulfillmentAddress: newAddress ?? null,
      fulfillmentOptionId: selectedOptionId,
      lineItems: sessionCalc.lineItems,
      fulfillmentOptions: sessionCalc.fulfillmentOptions,
      totals: sessionCalc.totals,
      messages: sessionCalc.messages,
      existingMetadata: session.metadata,
    });
    const status = mapCheckoutSessionStatus({
      status: updatePayload.status,
      hasFulfillmentAddress: !!newAddress,
      hasLineItems: sessionCalc.lineItems.length > 0,
    });
    const { data: updatedSession, error: updateError } = await supabase
      .from('checkout_sessions')
      .update(updatePayload)
      .eq('session_id', params.id)
      .eq('merchant_id', merchant.id)
      .is('order_id', null)
      .is('payment_reference', null)
      .is('virtual_account_number', null)
      .in('status', MUTABLE_CHECKOUT_SESSION_STATUSES)
      .select('session_id')
      .maybeSingle();
    if (updateError) {
      console.error('Failed to update checkout session:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!updatedSession) {
      return NextResponse.json(
        {
          error: 'Session already has pending payment',
          status: 'payment_pending',
        },
        { status: 409 }
      );
    }
    const responsePayload = buildCheckoutSessionStateResponse({
      currency: session.currency,
      fulfillmentOptionId: selectedOptionId,
      fulfillmentOptions: sessionCalc.fulfillmentOptions,
      lineItems: sessionCalc.lineItems,
      messages: sessionCalc.messages,
      policyBaseUrl: buildStoreUrl(merchant),
      sessionId: session.session_id,
      shippingAddress: newAddress,
      status,
      totals: sessionCalc.totals,
    });
    await storeAgenticIdempotencyResponse({
      key: mutation.idempotencyKey,
      merchantId: merchant.id,
      response: responsePayload,
      route: UPDATE_IDEMPOTENCY_ROUTE,
      status: 200,
      supabase,
    });
    return NextResponse.json(responsePayload, {
      headers: {
        'idempotency-key': mutation.idempotencyKey,
        'request-id': mutation.requestId,
      },
    });
  } catch (err) {
    console.error('Agentic Checkout Update Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
