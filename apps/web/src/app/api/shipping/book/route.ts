import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { clearOrderShipmentBookingLock } from '@/lib/shipping/order-shipment-booking-lock';
import {
  isShippingProviderCode,
  OrderShipmentBookingError,
} from '@/lib/shipping/order-shipment-booking-utils';
import type {
  ShipmentBookingResult,
  ShippingAddress,
} from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestSchema } from '@/schemas/shipping';
import { executeDirectBookingAttempt } from './execute-direct-booking-attempt';
import { persistBookedShipment } from './persist-booked-shipment';
import { prepareDirectBookingAttempt } from './prepare-direct-booking-attempt';
import {
  resolveBookingQuoteRequestPayload,
  validateBookingQuoteRequestPayload,
} from './quote-request-payload';

function bookingSuccessResponse(
  shipmentId: string,
  result: ShipmentBookingResult
) {
  return NextResponse.json(
    {
      success: true,
      shipment: {
        id: shipmentId,
        trackingNumber: result.trackingNumber,
        providerShipmentId: result.providerShipmentId,
        carrier: result.carrierName,
        status: result.status,
        pickupScheduledAt: result.pickupScheduledAt,
        labelUrl: result.labelUrl,
      },
    },
    { status: 201 }
  );
}

export async function POST(request: NextRequest) {
  let bookingLockToken: string | null = null;
  let retainBookingLock = false;
  let bookingSupabase: SupabaseClient | null = null;
  let bookingMerchantId = '';
  let bookingOrderId = '';
  try {
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    bookingSupabase = supabase;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'orders', 'fulfill')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    bookingMerchantId = merchantId;
    const body = await request.json();

    const parseResult = BookingRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    bookingOrderId = data.orderId;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, merchant_id, selected_quote_id, shipping_status, shipping_fee, shipping_address, order_items(name, quantity, price, product_id, product:products!order_items_product_id_fkey(weight_value, weight_unit, dimensions, commodity_code))'
      )
      .eq('id', data.orderId)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (
      ['shipped', 'delivered', 'processing'].includes(order.shipping_status)
    ) {
      return NextResponse.json(
        { error: 'Order has already been shipped or is being processed' },
        { status: 400 }
      );
    }

    if (order.selected_quote_id && order.selected_quote_id !== data.quoteId) {
      return NextResponse.json(
        { error: 'Quote does not match order' },
        { status: 400 }
      );
    }

    const { data: quote, error: quoteError } = await supabase
      .from('shipping_quotes')
      .select(
        'id, merchant_id, provider, service_tier, carrier_name, provider_rate_id, provider_metadata, quote_request, expires_at, price, currency, estimated_days'
      )
      .eq('id', data.quoteId)
      .eq('merchant_id', merchantId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found or expired' },
        { status: 404 }
      );
    }

    const quotePayload = resolveBookingQuoteRequestPayload(
      quote,
      {
        ...data.receiver,
        country: data.receiver.country || 'Nigeria',
        countryCode: data.receiver.countryCode || 'NG',
      },
      data.items,
      order.order_items ?? []
    );
    if (!quotePayload) {
      return NextResponse.json(
        { error: 'Saved international quote request not found' },
        { status: 400 }
      );
    }
    const quoteValidation = validateBookingQuoteRequestPayload(
      quotePayload,
      order,
      merchantId
    );
    if (!quoteValidation.ok) {
      return NextResponse.json(
        { error: quoteValidation.error, code: quoteValidation.code },
        { status: quoteValidation.status }
      );
    }

    if (!isShippingProviderCode(quote.provider)) {
      return NextResponse.json(
        { error: 'Invalid shipping provider in quote' },
        { status: 400 }
      );
    }

    const usesStoredInternationalSender = Boolean(quotePayload.sender);
    const bookingAttempt = await prepareDirectBookingAttempt(
      supabase,
      merchantId,
      data.orderId
    );
    if (bookingAttempt.status === 'in_progress') {
      return NextResponse.json(
        {
          error: 'Shipment booking is already in progress for this order.',
          code: 'SHIPMENT_BOOKING_IN_PROGRESS',
        },
        { status: 409 }
      );
    }
    if (bookingAttempt.status === 'already_booked') {
      return NextResponse.json(
        {
          error: 'A shipment is already booked for this order.',
          code: 'SHIPMENT_ALREADY_BOOKED',
        },
        { status: 409 }
      );
    }
    if (bookingAttempt.status === 'claimed') {
      bookingLockToken = bookingAttempt.lockToken;
    }

    let bookingQuote = quote;
    let result: ShipmentBookingResult;
    let resolvedSenderInfo: ShippingAddress | undefined;
    if (bookingAttempt.status === 'recovered') {
      result = bookingAttempt.result;
    } else {
      const quoteExpired = new Date(quote.expires_at) < new Date();
      if (quoteExpired && usesStoredInternationalSender) {
        return NextResponse.json(
          { error: 'Quote has expired. Please get a new quote.' },
          { status: 400 }
        );
      }
      const booking = await executeDirectBookingAttempt({
        supabase,
        merchantId,
        merchantBusinessName: merchantContext.businessName,
        orderId: data.orderId,
        quote,
        quotePayload,
        usesStoredInternationalSender,
        expectedShippingFee: order.shipping_fee,
        instructions: data.instructions,
      });
      bookingQuote = booking.bookingQuote;
      result = booking.result;
      resolvedSenderInfo = booking.senderInfo;
    }

    const persisted = await persistBookedShipment({
      supabase,
      orderId: data.orderId,
      merchantId,
      senderInfo: resolvedSenderInfo,
      receiver:
        bookingAttempt.status === 'recovered'
          ? undefined
          : quotePayload.receiver,
      items:
        bookingAttempt.status === 'recovered' ? undefined : quotePayload.items,
      bookingQuote,
      result,
      existingShipment:
        bookingAttempt.status === 'recovered'
          ? bookingAttempt.existingShipment
          : undefined,
      bookingLockToken,
      clearBookingLock: bookingAttempt.status === 'recovered',
    });
    if (!persisted.ok) {
      retainBookingLock = true;
      return NextResponse.json(
        {
          error: persisted.error,
          trackingNumber: persisted.trackingNumber,
        },
        { status: persisted.status }
      );
    }

    bookingLockToken = null;
    return bookingSuccessResponse(persisted.shipmentId, result);
  } catch (error) {
    if (error instanceof OrderShipmentBookingError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    console.error('Error booking shipment:', error);
    return NextResponse.json(
      { error: 'Failed to book shipment' },
      { status: 500 }
    );
  } finally {
    if (bookingLockToken && bookingSupabase && !retainBookingLock) {
      try {
        await clearOrderShipmentBookingLock(
          bookingSupabase,
          bookingMerchantId,
          bookingOrderId,
          bookingLockToken
        );
      } catch {
        // The lock is left to expire if cleanup cannot be completed here.
      }
    }
  }
}
