import { type NextRequest, NextResponse } from 'next/server';
import { getIdempotencyKey, verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  // 1. Auth & Idempotency
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idempotencyKey = getIdempotencyKey(request); // ToDo: Implement idempotent checks if needed

  let body: Awaited<ReturnType<NextRequest['json']>>;

  try {
    body = await request.json();
  } catch (err) {
    console.error('Agentic Checkout Create JSON Parse Error:', err);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const { items, fulfillment_address, currency = 'NGN' } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    // 2. Calculate Cart State
    const supabase = createServiceClient();

    // Default merchant: We need to know WHICH merchant this is for.
    // Spec doesn't pass merchant_id in body usually (it's tied to the API key or domain).
    // However, our system is multi-tenant.
    // Option A: API Key is unique per merchant? (Complex to manage)
    // Option B: API Key is platform-wide (Agentic -> Platform)?
    // Option C: We hardcode a default merchant for now (Ogabassey)?
    // Since `verifyAgenticApiKey` uses a single strict env var, this implies ONE merchant context for now.
    // Let's look up Ogabassey merchant ID or similar default.
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('slug', 'ogabassey') // Hardcoded for this implementation
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Default merchant not found' },
        { status: 500 }
      );
    }

    const sessionCalc = await calculateCheckoutSession(
      supabase,
      items,
      null,
      currency
    );

    // 3. Create Session in DB
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .insert({
        merchant_id: merchant.id,
        items: items, // Raw input
        line_items: sessionCalc.lineItems,
        totals: sessionCalc.totals,
        fulfillment_options: sessionCalc.fulfillmentOptions,
        currency,
        fulfillment_address, // Persist address
        status: 'not_ready_for_payment', // Default
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create checkout session:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 4. Response
    const responsePayload = {
      id: session.id,
      status: 'not_ready_for_payment',
      currency: currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      totals: sessionCalc.totals,
      fulfillment_options: sessionCalc.fulfillmentOptions,
      messages: sessionCalc.messages,
      links: [
        { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
        { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
      ],
    };

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        'idempotency-key': idempotencyKey || '',
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
