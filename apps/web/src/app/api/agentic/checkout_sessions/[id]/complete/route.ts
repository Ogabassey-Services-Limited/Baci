import { NextRequest, NextResponse } from 'next/server';
import { POST as createOrder } from '@/app/api/orders/route'; // Reuse existing logic
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import {
  type CheckoutItem,
  calculateCheckoutSession,
  type GPTTotal,
} from '@/lib/agentic/checkout';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
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

    if (!payment_data?.token) {
      return NextResponse.json(
        { error: 'Payment token required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select(
        'id, merchant_id, items, fulfillment_option_id, fulfillment_address, currency, status, metadata'
      )
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
      session.items as unknown as CheckoutItem[],
      session.fulfillment_option_id,
      session.currency
    );
    const grandTotal = sessionCalc.totals.find(
      (t: GPTTotal) => t.type === 'total'
    )?.amount;

    if (!grandTotal)
      return NextResponse.json(
        { error: 'Could not calculate total' },
        { status: 500 }
      );

    // 2. Generate Paystack DVA (User Request: "Let the agentic payment module b our paystack dvas")
    // Instead of charging a card immediately, we generate a virtual account for the user to transfer to.

    // Check if we already have DVA details in metadata or similar?
    // For now, generate new one or retrieve existing.
    const { createDedicatedVirtualAccount } = await import(
      '@/lib/agentic/paystack'
    );

    let dvaResult: Awaited<ReturnType<typeof createDedicatedVirtualAccount>>;
    try {
      dvaResult = await createDedicatedVirtualAccount({
        email: buyer.email,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        phone: buyer.phone_number,
      });
    } catch (dvaError: unknown) {
      logger.error({
        message: 'DVA Creation Failed',
        error: dvaError,
        sessionId: sanitizeForLog(params.id),
      });
      const errorMessage =
        dvaError instanceof Error ? dvaError.message : 'Unknown error';
      return NextResponse.json(
        {
          error: 'Failed to generate payment account',
          details: errorMessage,
        },
        { status: 502 }
      );
    }

    // 3. Create Order via internal API call (Reuse Logic) - Status: Pending Payment
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
      payment_method: 'bank_transfer', // Paystack DVA
      payment_status: 'pending', // Waiting for transfer
      payment_provider_reference: dvaResult.account_number, // Store Account Number as Ref
      shipping_status: 'pending',
      shipping_address: session.fulfillment_address,
      source: 'agentic_ai',
      notes: `Agentic Checkout Session: ${session.id} | DVA: ${dvaResult.bank_name} - ${dvaResult.account_number}`,
    };

    const internalReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
      headers: {
        'content-type': 'application/json',
        'x-agentic-internal': 'true',
      },
    });

    const orderRes = await createOrder(internalReq);
    const orderData = await orderRes.json();

    if (orderRes.status !== 200 && orderRes.status !== 201) {
      logger.error({
        message: 'Order creation failed',
        status: orderRes.status,
        statusText: orderRes.statusText,
        sessionId: sanitizeForLog(params.id),
      });
      return NextResponse.json(
        { error: 'Order creation failed', details: orderData.error },
        { status: 500 }
      );
    }

    // 4. Update Session
    const orderId = orderData.order?.id || orderData.id;

    await supabase
      .from('checkout_sessions')
      .update({
        status: 'payment_pending', // New status for DVA flow
        order_id: orderId,
        buyer: buyer,
        metadata: {
          ...session.metadata,
          dva_account: dvaResult,
        },
      })
      .eq('id', params.id);

    // 5. Send Webhook (Async)
    const { sendAgenticWebhook } = await import('@/lib/agentic/webhooks');
    sendAgenticWebhook('order.created', {
      id: orderId,
      currency: session.currency,
      total: sessionCalc.totals.find((t: GPTTotal) => t.type === 'total')
        ?.amount,
      status: 'pending',
      buyer,
    }).catch((err) =>
      logger.error({
        message: 'Webhook trigger failed',
        error: err,
        sessionId: params.id,
      })
    );

    // 6. Success Response
    return NextResponse.json({
      id: session.id,
      buyer,
      status: 'payment_pending',
      currency: session.currency.toLowerCase(),
      line_items: sessionCalc.lineItems,
      shipping_address: session.fulfillment_address,
      fulfillment_option_id: session.fulfillment_option_id,
      totals: sessionCalc.totals,
      order_id: orderId, // Extra field helpful for debugging
      payment_details: {
        type: 'bank_transfer',
        bank_name: dvaResult.bank_name,
        account_number: dvaResult.account_number,
        account_name: dvaResult.account_name,
        message:
          'Please transfer the exact total to this account to complete your order.',
      },
      messages: [],
      links: [],
    });
  } catch (err: unknown) {
    logger.error({
      message: 'Agentic Checkout Complete Error',
      error: err,
      sessionId: params.id,
    });
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
