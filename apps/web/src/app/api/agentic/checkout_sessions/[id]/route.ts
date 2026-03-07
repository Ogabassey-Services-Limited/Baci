import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import {
  type CheckoutItem,
  calculateCheckoutSession,
} from '@/lib/agentic/checkout';
import { createServiceClient } from '@/lib/supabase/service';

// Helper to get session from DB
async function getSession(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('checkout_sessions')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: session, error } = await getSession(supabase, params.id);

  if (error || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Construct response from stored data
  // NOTE: Should we re-calculate?
  // Spec says: "GET /checkout_sessions/{id} ... returns full cart state".
  // If we store the *calculated* totals in DB, we can just return them.
  // But if products update, stored totals might be stale.
  // Ideally, re-calculate on GET to be safe.

  const items = session.items; // Raw items
  const fulfillmentOptionId = session.fulfillment_option_id;
  const currency = session.currency;

  const sessionCalc = await calculateCheckoutSession(
    supabase,
    items as CheckoutItem[],
    fulfillmentOptionId,
    currency
  );

  return NextResponse.json({
    id: session.id,
    status: session.status,
    currency: currency.toLowerCase(),
    line_items: sessionCalc.lineItems,
    totals: sessionCalc.totals,
    fulfillment_options: sessionCalc.fulfillmentOptions,
    fulfillment_option_id: fulfillmentOptionId, // Selected
    fulfillment_address: session.fulfillment_address,
    messages: sessionCalc.messages,
    links: [
      { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
      { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
    ],
  });
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { items, fulfillment_address, fulfillment_option_id } = body;
    // Note: Spec allows updating items, address, or option.

    const supabase = createServiceClient();
    const { data: session, error } = await getSession(supabase, params.id);

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Merge updates
    const newItems = items || session.items;
    const newAddress = fulfillment_address || session.fulfillment_address;
    const newOptionId =
      fulfillment_option_id !== undefined
        ? fulfillment_option_id
        : session.fulfillment_option_id;

    // Recalculate
    const sessionCalc = await calculateCheckoutSession(
      supabase,
      newItems as CheckoutItem[],
      newOptionId,
      session.currency
    );

    // Determine status
    // If we have address and option and items, are we ready?
    let newStatus = 'in_progress';
    if (newAddress && sessionCalc.lineItems.length > 0) {
      // Simple logic: if address provided, we can populate taxes/shipping properly (mocked in checkout.ts).
      // If we have a selected option (or default), we are ready.
      newStatus = 'ready_for_payment';
    }

    // Update DB
    await supabase
      .from('checkout_sessions')
      .update({
        items: newItems,
        fulfillment_address: newAddress,
        fulfillment_option_id: newOptionId,
        line_items: sessionCalc.lineItems,
        totals: sessionCalc.totals,
        fulfillment_options: sessionCalc.fulfillmentOptions,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    return NextResponse.json({
      id: session.id,
      status: newStatus,
      currency: session.currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      totals: sessionCalc.totals,
      fulfillment_options: sessionCalc.fulfillmentOptions,
      fulfillment_option_id: newOptionId,
      fulfillment_address: newAddress,
      messages: sessionCalc.messages,
      links: [
        { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
        { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
      ],
    });
  } catch (err: unknown) {
    console.error('Agentic Checkout Update Error:', err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
