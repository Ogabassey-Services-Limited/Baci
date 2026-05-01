import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { resolveExistingPaymentState } from '@/lib/agentic/checkout-completion-response';
import { getAgenticCheckoutSession } from '@/lib/agentic/checkout-session-record';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';
import { mapCheckoutSessionStatus } from '@/lib/agentic/checkout-storage';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { buildStoreUrl } from '@/lib/store-url';
import { createServiceClient } from '@/lib/supabase/service';
import { agenticCheckoutItemsSchema } from '@/schemas/agentic-checkout';
import { agenticCheckoutSessionRouteParamsSchema } from '@/schemas/agentic-checkout-session-route-params';

export async function handleAgenticCheckoutSessionGet(
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
    sessionId: parsedParams.data.id,
    supabase,
  });
  if (error) {
    logger.error({
      message: 'Failed to fetch checkout session',
      error: sanitizeForLog(error),
      sessionId: parsedParams.data.id,
    });
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
