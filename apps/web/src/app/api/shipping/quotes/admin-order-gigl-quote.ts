import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { ShippingService } from '@/lib/shipping';
import { buildOrderGiglQuoteRequest } from '@/lib/shipping/build-order-gigl-quote-request';
import { persistAdminGiglQuote } from '@/lib/shipping/persist-admin-gigl-quote';
import { resolveBookingMerchantSender } from '@/lib/shipping/resolve-booking-merchant-sender';
import type { ShippingQuote } from '@/lib/shipping/types';
import {
  adminOrderGiglQuoteSchema,
  orderGiglQuoteSchema,
} from '@/schemas/order-gigl-shipping';
import { toPublicQuoteResponse } from './public-quote-response';
import { resolveAdminGiglEligibility } from './resolve-admin-gigl-eligibility';
import { toShippingQuoteUpsert } from './shipping-quote-persistence';

type AdminInput = {
  admin_order_id: string;
  receiver?: { address: string; city: string; state: string; phone: string };
};

export function selectEligibleAdminGiglQuote(quotes: ShippingQuote[]) {
  return (
    quotes
      .filter(
        (quote) =>
          quote.provider === 'GIGL' &&
          quote.currency === 'NGN' &&
          !quote.isStationPickup &&
          quote.price > 0
      )
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

export function calculateAdminWalletFunding(price: number, balance: number) {
  const availableBalance = Math.max(0, Number.isFinite(balance) ? balance : 0);
  const shortfall = Math.max(0, price - availableBalance);
  return { availableBalance, shortfall, canBook: shortfall === 0 };
}

const orderSelect =
  'id, merchant_id, customer_name, customer_phone, customer_email, shipping_address, shipping_status, shipment_id, tracking_number, order_items(id, name, quantity, price, product_id, product:products!order_items_product_id_fkey(weight_value, weight_unit))';

function publicQuote(quote: ShippingQuote) {
  return toPublicQuoteResponse({
    quotes: { featured: [quote], all: [quote] },
    sessionId: quote.id,
    expiresAt: quote.expiresAt.toISOString(),
  }).quotes.featured[0];
}

export async function postAdminOrderGiglQuote(
  request: NextRequest,
  input?: Partial<AdminInput>
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.user || !auth.supabase)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid)
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  let resolvedInput = input;
  if (!resolvedInput?.admin_order_id || resolvedInput.receiver === undefined) {
    const body = await request.json().catch(() => null);
    const headerOrderId = request.headers.get('x-baci-admin-order-id');
    const parsed =
      resolvedInput?.admin_order_id || headerOrderId
        ? orderGiglQuoteSchema.safeParse(body)
        : adminOrderGiglQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const parsedOrderId =
      'admin_order_id' in parsed.data &&
      typeof parsed.data.admin_order_id === 'string'
        ? parsed.data.admin_order_id
        : undefined;
    resolvedInput = {
      admin_order_id:
        resolvedInput?.admin_order_id ?? headerOrderId ?? parsedOrderId ?? '',
      receiver: resolvedInput?.receiver ?? parsed.data.receiver,
    };
  }
  const validatedInput = adminOrderGiglQuoteSchema.safeParse(resolvedInput);
  if (!validatedInput.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validatedInput.error.flatten() },
      { status: 400 }
    );
  }
  const adminOrderId = validatedInput.data.admin_order_id;

  const access = await getUserAccess(auth.supabase);
  if (
    !access?.isOwner ||
    !access.merchantId ||
    !hasPermission(access, 'orders', 'fulfill')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const eligibility = await resolveAdminGiglEligibility(
    auth.supabase,
    access.merchantId
  );
  if (!eligibility.ok) {
    return NextResponse.json(eligibility.body, { status: eligibility.status });
  }

  const { data: order, error: orderError } = await auth.supabase
    .from('orders')
    .select(orderSelect)
    .eq('id', adminOrderId)
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
  ) {
    return NextResponse.json(
      { error: 'Order already shipped or booked' },
      { status: 409 }
    );
  }
  if (String(order.shipping_status).toLowerCase() !== 'processing') {
    return NextResponse.json(
      { error: 'Order must be processing before shipping' },
      { status: 409 }
    );
  }

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
    validatedInput.data.receiver
  );
  if (!built.ok) {
    return NextResponse.json(
      {
        error: built.code,
        code: built.code,
        ...(built.missing ? { missing: built.missing } : {}),
      },
      { status: built.status }
    );
  }

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
  const quote = selectEligibleAdminGiglQuote(quotes);
  if (!quote)
    return NextResponse.json(
      { error: 'No eligible GIGL address-delivery quote' },
      { status: 503 }
    );
  const quoteRequest = {
    ...built.request,
    admin_order_provenance: 'server_gigl_v1' as const,
  };
  const persisted = toShippingQuoteUpsert(quote, {
    merchantId: access.merchantId,
    sessionId: adminOrderId,
    quoteRequest,
  });
  const { error: persistError } = await persistAdminGiglQuote({
    supabase: auth.supabase,
    quote: persisted,
    attestation: {
      quote_id: quote.id,
      order_id: adminOrderId,
      merchant_id: access.merchantId,
      provider_rate_id: quote.providerRateId ?? null,
      quote_request: quoteRequest,
    },
  });
  if (persistError) {
    console.error('Error persisting Admin GIGL quote', {
      message: persistError.message,
    });
    return NextResponse.json(
      { error: 'Failed to persist quote' },
      { status: 500 }
    );
  }

  const { data: binding, error: bindError } = await auth.supabase.rpc(
    'bind_admin_gigl_quote' as never,
    {
      p_order_id: adminOrderId,
      p_merchant_id: access.merchantId,
      p_quote_id: quote.id,
      p_receiver: built.request.receiver,
    } as never
  );
  if (bindError) {
    const already = bindError.message?.includes('already');
    return NextResponse.json(
      {
        error: already
          ? 'Order already shipped or booked'
          : 'Failed to bind quote',
      },
      { status: already ? 409 : 500 }
    );
  }
  const result = (Array.isArray(binding) ? binding[0] : binding) as {
    available_balance?: number;
  } | null;
  const { availableBalance, shortfall, canBook } = calculateAdminWalletFunding(
    quote.price,
    Number(result?.available_balance ?? 0)
  );
  return NextResponse.json({
    quote: publicQuote(quote),
    availableBalance,
    shortfall,
    canBook,
  });
}
