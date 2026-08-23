import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { shippingService } from '@/lib/shipping';
import {
  isShippingProviderCode,
  OrderShipmentBookingError,
} from '@/lib/shipping/order-shipment-booking-utils';
import { resolveBookingMerchantSender } from '@/lib/shipping/resolve-booking-merchant-sender';
import type { BookingRequest, ShippingAddress } from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestSchema } from '@/schemas/shipping';
import { persistBookedShipment } from './persist-booked-shipment';
import {
  resolveBookingQuoteRequestPayload,
  validateBookingQuoteRequestPayload,
} from './quote-request-payload';
import { resolveBookingQuoteForSender } from './resolve-booking-quote-for-sender';

export async function POST(request: NextRequest) {
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

    if (new Date(quote.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Quote has expired. Please get a new quote.' },
        { status: 400 }
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

    // Domestic bookings ignore request-controlled data.sender and always use
    // the registered merchant origin. International quotes keep the saved
    // quotePayload.sender from the stored international request and therefore
    // do not need the merchant's current registered address.
    const usesStoredInternationalSender = Boolean(quotePayload.sender);
    let merchantSender: ShippingAddress | undefined;
    if (!usesStoredInternationalSender) {
      const merchantSenderResult = await resolveBookingMerchantSender(
        supabase,
        merchantId,
        merchantContext.businessName
      );
      if (!merchantSenderResult.ok) {
        return NextResponse.json(
          { error: merchantSenderResult.error },
          { status: merchantSenderResult.status }
        );
      }
      merchantSender = merchantSenderResult.sender;
    }

    // Domestic bookings replace the quote-time sender with the registered
    // merchant origin; refresh first when that origin differs so we do not
    // book with rate IDs / metadata priced for another station.
    const bookingQuote = await resolveBookingQuoteForSender(
      supabase,
      quote,
      quote.provider,
      {
        merchantSender,
        usesStoredInternationalSender,
        expectedShippingFee: order.shipping_fee,
      }
    );

    const resolvedSenderInfo = quotePayload.sender ?? merchantSender;
    if (!resolvedSenderInfo) {
      return NextResponse.json(
        {
          error:
            'Registered merchant sender is required for domestic shipment booking.',
        },
        { status: 400 }
      );
    }

    const bookingRequest: BookingRequest = {
      orderId: data.orderId,
      quoteId: bookingQuote.id,
      providerRateId: bookingQuote.provider_rate_id || undefined,
      quoteMetadata: bookingQuote.provider_metadata,
      sender: resolvedSenderInfo,
      receiver: quotePayload.receiver,
      items: quotePayload.items,
      instructions: data.instructions,
    };

    const result = await shippingService.bookShipment(
      quote.provider,
      bookingRequest
    );

    const persisted = await persistBookedShipment({
      supabase,
      orderId: data.orderId,
      merchantId,
      senderInfo: resolvedSenderInfo,
      receiver: quotePayload.receiver,
      items: quotePayload.items,
      bookingQuote,
      result,
    });
    if (!persisted.ok) {
      return NextResponse.json(
        {
          error: persisted.error,
          trackingNumber: persisted.trackingNumber,
        },
        { status: persisted.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        shipment: {
          id: persisted.shipmentId,
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
  }
}
