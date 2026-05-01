import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { hasCheckoutPaymentSideEffect } from '@/lib/agentic/checkout-completion-response';
import {
  getAgenticCheckoutSession,
  MUTABLE_CHECKOUT_SESSION_STATUSES,
} from '@/lib/agentic/checkout-session-record';
import { mapCheckoutSessionStatus } from '@/lib/agentic/checkout-storage';
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
import { agenticCheckoutItemsSchema } from '@/schemas/agentic-checkout';

const CANCEL_IDEMPOTENCY_ROUTE = 'checkout_sessions.cancel';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params; // Next.js 15+ await params

  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }

  try {
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
      route: CANCEL_IDEMPOTENCY_ROUTE,
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
    const respond = (response: unknown, status: number) =>
      buildStoredAgenticIdempotencyResponse({
        idempotencyKey: mutation.idempotencyKey,
        merchantId: merchant.id,
        requestId: mutation.requestId,
        response,
        route: CANCEL_IDEMPOTENCY_ROUTE,
        status,
        supabase,
      });

    // Check if exists
    const { data: session, error: fetchError } =
      await getAgenticCheckoutSession({
        merchantId: merchant.id,
        sessionId: params.id,
        supabase,
      });

    if (fetchError) {
      logger.error({
        message: 'Failed to fetch checkout session',
        error: fetchError,
        sessionId: params.id,
      });
      return await respond({ error: 'Database error' }, 500);
    }
    if (!session) return await respond({ error: 'Session not found' }, 404);
    if (session.status === 'completed')
      return await respond({ error: 'Cannot cancel completed session' }, 409);
    if (!MUTABLE_CHECKOUT_SESSION_STATUSES.includes(session.status))
      return await respond({ error: 'Session cannot be canceled' }, 409);
    if (hasCheckoutPaymentSideEffect(session))
      return await respond(
        {
          error: 'Session already has pending payment',
          status: 'payment_pending',
        },
        409
      );

    // Update status
    const { data: updatedSession, error: updateError } = await supabase
      .from('checkout_sessions')
      .update({ status: 'abandoned' })
      .eq('session_id', params.id)
      .eq('merchant_id', merchant.id)
      .is('order_id', null)
      .is('payment_reference', null)
      .is('virtual_account_number', null)
      .in('status', MUTABLE_CHECKOUT_SESSION_STATUSES)
      .select('session_id')
      .maybeSingle();

    if (updateError) {
      logger.error({
        message: 'Failed to cancel checkout session',
        error: updateError,
        sessionId: params.id,
      });
      return await respond({ error: 'Database error' }, 500);
    }
    if (!updatedSession) {
      return await respond(
        {
          error: 'Session was modified concurrently',
          status: 'concurrent_modification',
        },
        409
      );
    }

    const parsedCartItems = agenticCheckoutItemsSchema.safeParse(
      session.cart_items
    );
    let sessionCalc: Awaited<ReturnType<typeof calculateCheckoutSession>> = {
      fulfillmentOptions: [],
      lineItems: [],
      messages: [],
      selectedOptionId: session.shipping_method ?? undefined,
      totals: [],
    };
    if (parsedCartItems.success) {
      try {
        sessionCalc = await calculateCheckoutSession(
          supabase,
          parsedCartItems.data,
          session.shipping_method,
          session.currency,
          merchant.id
        );
      } catch (error) {
        logger.warn({
          message: 'Canceled checkout session response calculation failed',
          error,
          sessionId: params.id,
        });
      }
    } else {
      logger.warn({
        message: 'Canceled checkout session has invalid cart items',
        error: parsedCartItems.error.flatten(),
        sessionId: params.id,
      });
    }

    const responsePayload = {
      id: session.session_id,
      status: mapCheckoutSessionStatus({
        status: 'abandoned',
        hasFulfillmentAddress: !!session.shipping_address,
        hasLineItems: sessionCalc.lineItems.length > 0,
      }),
      currency: session.currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      totals: sessionCalc.totals,
      fulfillment_options: sessionCalc.fulfillmentOptions,
      fulfillment_option_id: session.shipping_method,
      shipping_address: session.shipping_address,
      messages: sessionCalc.messages,
    };

    return await respond(responsePayload, 200);
  } catch (err: unknown) {
    logger.error({
      message: 'Agentic checkout cancel error',
      error: err,
      sessionId: params.id,
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
