import { type NextRequest, NextResponse } from 'next/server';
import { toPublicQuoteResponse } from '@/app/api/shipping/quotes/public-quote-response';
import { toShippingQuoteUpsert } from '@/app/api/shipping/quotes/shipping-quote-persistence';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { ShippingService } from '@/lib/shipping';
import { buildOrderGiglQuoteRequest } from '@/lib/shipping/build-order-gigl-quote-request';
import { resolveBookingMerchantSender } from '@/lib/shipping/resolve-booking-merchant-sender';
import type { ShippingQuote } from '@/lib/shipping/types';
import { orderGiglQuoteSchema } from '@/schemas/order-gigl-shipping';

type Params = { params: Promise<{ id: string }> };

function publicQuote(
  quote: Awaited<ReturnType<ShippingService['getProviderQuotes']>>[number]
) {
  return toPublicQuoteResponse({
    quotes: { featured: [quote], all: [quote] },
    sessionId: quote.id,
    expiresAt: quote.expiresAt.toISOString(),
  }).quotes.featured[0];
}

export async function POST(request: NextRequest, context: Params) {
  const auth = await authenticateApiRequest(request);
  if (!auth.user || !auth.supabase)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await getUserAccess(auth.supabase);
  if (
    !access?.isOwner ||
    !access.merchantId ||
    !hasPermission(access, 'orders', 'fulfill')
  )
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = orderGiglQuoteSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  const { id } = await context.params;
  const { data: order, error: orderError } = await auth.supabase
    .from('orders')
    .select(
      'id, merchant_id, customer_name, customer_phone, customer_email, shipping_address, shipping_fee, subtotal, tax_amount, discount_amount, total, shipping_status, shipment_id, tracking_number, selected_quote_id, order_items(id, name, quantity, price, product_id, product:products(weight_value, weight_unit))'
    )
    .eq('id', id)
    .eq('merchant_id', access.merchantId)
    .maybeSingle();
  if (orderError)
    return NextResponse.json(
      { error: 'Failed to load order' },
      { status: 500 }
    );
  if (!order)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (
    order.shipment_id ||
    order.tracking_number ||
    ['shipped', 'booked', 'in_transit'].includes(
      String(order.shipping_status).toLowerCase()
    )
  )
    return NextResponse.json(
      { error: 'Order already shipped or booked' },
      { status: 409 }
    );
  const senderResult = await resolveBookingMerchantSender(
    auth.supabase,
    access.merchantId
  );
  if (!senderResult.ok)
    return NextResponse.json(
      { error: senderResult.error },
      { status: senderResult.status }
    );
  const rawItems = (order.order_items ?? []).map((item) => ({
    ...item,
    weight_value:
      (item as { product?: { weight_value?: number | null } | null }).product
        ?.weight_value ?? null,
    weight_unit:
      (item as { product?: { weight_unit?: string | null } | null }).product
        ?.weight_unit ?? null,
  }));
  const built = await buildOrderGiglQuoteRequest(
    { ...order, order_items: rawItems },
    senderResult.sender,
    async () => ({}),
    parsed.data.receiver
  );
  if (!built.ok)
    return NextResponse.json(
      {
        error: built.code,
        code: built.code,
        ...(built.missing ? { missing: built.missing } : {}),
      },
      { status: built.status }
    );
  let quotes: ShippingQuote[];
  try {
    quotes = await new ShippingService().getProviderQuotes(
      'GIGL',
      built.request
    );
  } catch {
    return NextResponse.json(
      { error: 'GIGL quote unavailable' },
      { status: 503 }
    );
  }
  const eligible = quotes.filter(
    (quote) => !quote.isStationPickup && quote.currency === 'NGN'
  );
  if (!eligible.length)
    return NextResponse.json(
      { error: 'No eligible GIGL address-delivery quote' },
      { status: 503 }
    );
  const quote = [...eligible].sort((a, b) => a.price - b.price)[0];
  const { error: upsertError } = await auth.supabase
    .from('shipping_quotes')
    .upsert(
      toShippingQuoteUpsert(quote, {
        merchantId: access.merchantId,
        sessionId: id,
        quoteRequest: built.request,
      })
    );
  if (upsertError)
    return NextResponse.json(
      { error: 'Failed to persist quote' },
      { status: 500 }
    );
  const { error: updateError } = await auth.supabase
    .from('orders')
    .update({
      selected_quote_id: quote.id,
      shipping_provider: 'GIGL',
      shipping_address: built.request.receiver,
      shipping_funding_source: 'merchant_wallet',
    })
    .eq('id', id)
    .eq('merchant_id', access.merchantId)
    .is('shipment_id', null);
  if (updateError)
    return NextResponse.json(
      { error: 'Failed to bind quote' },
      { status: 500 }
    );
  const { data: wallet, error: walletError } = await auth.supabase.rpc(
    'get_wallet_summary',
    { p_merchant_id: access.merchantId }
  );
  if (walletError)
    return NextResponse.json(
      { error: 'Failed to load wallet' },
      { status: 500 }
    );
  const availableBalance = Math.max(
    0,
    Number((Array.isArray(wallet) ? wallet[0] : wallet)?.available_balance ?? 0)
  );
  const shortfall = Math.max(0, quote.price - availableBalance);
  return NextResponse.json({
    quote: publicQuote(quote),
    availableBalance,
    shortfall,
    canBook: shortfall === 0,
  });
}
