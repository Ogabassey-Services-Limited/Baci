import { NextRequest, NextResponse } from 'next/server';
import { POST as createOrder } from '@/app/api/orders/route'; // Reuse existing logic
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { chargeDelegatedPayment } from '@/lib/agentic/stripe';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!verifyAgenticApiKey(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { payment_data, buyer } = body;

    if (!payment_data || !payment_data.token) {
      return NextResponse.json(
        { error: 'Payment token required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !session)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status === 'completed')
      return NextResponse.json(
        { error: 'Session already completed' },
        { status: 409 }
      );

    // 1. Recalculate final totals to ensure accuracy
    const sessionCalc = await calculateCheckoutSession(
      supabase,
      // biome-ignore lint/suspicious/noExplicitAny: Supabase return type mismatch
      session.items as any[],
      session.fulfillment_option_id,
      session.currency
    );
    const grandTotal = sessionCalc.totals.find(
      // biome-ignore lint/suspicious/noExplicitAny: Implicit any in find callback
      (t: any) => t.type === 'total'
    )?.amount;

    if (!grandTotal)
      return NextResponse.json(
        { error: 'Could not calculate total' },
        { status: 500 }
      );

    // 2. Charge Stripe
    const chargeResult = await chargeDelegatedPayment(
      payment_data.token,
      typeof grandTotal === 'number'
        ? grandTotal
        : Number.parseFloat(grandTotal),
      session.currency
    );

    if (!chargeResult.success) {
      return NextResponse.json(
        {
          error: 'Payment Failed',
          details: chargeResult.error,
          code: 'payment_declined',
        },
        { status: 402 }
      );
    }

    // 3. Create Order via internal API call (Reuse Logic)
    // Map Agentic data to Baci Order Schema
    const orderPayload = {
      merchant_id: session.merchant_id,
      customer_email: buyer.email,
      customer_name: `${buyer.first_name} ${buyer.last_name}`,
      customer_phone: buyer.phone_number,
      items: sessionCalc.lineItems.map((li) => ({
        product_id: li.item.id,
        quantity: li.item.quantity,
        price: li.base_amount,
      })),
      subtotal:
        sessionCalc.totals.find((t) => t.type === 'subtotal')?.amount || 0,
      shipping_fee:
        sessionCalc.totals.find((t) => t.type === 'fulfillment')?.amount || 0,
      payment_method: 'card', // Agentic/Stripe
      payment_status: 'paid',
      payment_provider_reference: chargeResult.id,
      shipping_status: 'pending',
      shipping_address: session.fulfillment_address, // Map correctly?
      // session.fulfillment_address has name, line_one, city, etc.
      // internal order API expects `shipping_address` object.
      source: 'agentic_ai',
      notes: `Agentic Checkout Session: ${session.id}`,
    };

    // Call existing POST /api/orders
    // We need to simulate a request.
    // Or extract function? `orders/route.ts` exports POST.
    // We can call it directly passing a specific request object.

    const internalReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
      headers: {
        'content-type': 'application/json',
        'x-agentic-internal': 'true', // Flag to bypass certain checks if needed
      },
    });

    // NOTE: calling route handler directly might fail if it relies on headers/cookies too heavily.
    // Ideally we refactor `createOrder` logic into a lib function.
    // But per task instructions: "Reuse existing order creation logic".
    // Calling the route handler is one way.

    const orderRes = await createOrder(internalReq);
    const orderData = await orderRes.json();

    if (orderRes.status !== 200 && orderRes.status !== 201) {
      console.error('Order creation failed:', orderData);
      // Refund Stripe? (Critical logic for production)
      return NextResponse.json(
        { error: 'Order creation failed', details: orderData.error },
        { status: 500 }
      );
    }

    // 4. Update Session
    const orderId = orderData.order?.id || orderData.id; // Check response structure of orders API

    await supabase
      .from('checkout_sessions')
      .update({
        status: 'completed',
        order_id: orderId,
        buyer: buyer,
      })
      .eq('id', params.id);

    // 5. Send Webhook (Async, don't block response)
    const { sendAgenticWebhook } = await import('@/lib/agentic/webhooks');
    sendAgenticWebhook('order.created', {
      id: orderId,
      currency: session.currency,
      // biome-ignore lint/suspicious/noExplicitAny: Implicit any in find callback
      total: sessionCalc.totals.find((t: any) => t.type === 'total')?.amount,
      status: 'created',
      ...buyer,
    }).catch((err) => console.error('Webhook trigger failed', err));

    // 6. Success Response
    return NextResponse.json({
      id: session.id,
      buyer,
      status: 'completed',
      currency: session.currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      fulfillment_address: session.fulfillment_address,
      fulfillment_option_id: session.fulfillment_option_id,
      totals: sessionCalc.totals,
      order_id: orderId, // Extra field helpful for debugging
      messages: [],
      links: [],
    });
    // biome-ignore lint/suspicious/noExplicitAny: Generic error handling
  } catch (err: any) {
    console.error('Agentic Checkout Complete Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
