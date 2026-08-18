import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { shippingService } from '@/lib/shipping';
import { buildMerchantSenderInfo } from '@/lib/shipping/merchant-sender-location';
import {
  isShippingProviderCode,
  OrderShipmentBookingError,
} from '@/lib/shipping/order-shipment-booking-utils';
import type { BookingRequest } from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestSchema } from '@/schemas/shipping';
import {
  resolveBookingQuoteRequestPayload,
  validateBookingQuoteRequestPayload,
} from './quote-request-payload';
import { buildShipmentInsertPayload } from './shipment-insert-payload';

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
        'id, merchant_id, selected_quote_id, shipping_status, shipping_address, order_items(name, quantity, price, product_id, product:products!order_items_product_id_fkey(weight_value, weight_unit, dimensions, commodity_code))'
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
        'id, merchant_id, provider, provider_rate_id, provider_metadata, quote_request, expires_at, price, currency, estimated_days'
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

    let senderInfo = data.sender;
    if (!senderInfo) {
      const { data: merchantDetails } = await supabase
        .from('merchants')
        .select(
          'business_name, business_address, phone, registered_address, state_code'
        )
        .eq('id', merchantId)
        .single();

      senderInfo = buildMerchantSenderInfo({
        businessAddress: merchantDetails?.business_address ?? null,
        businessName:
          merchantDetails?.business_name ?? merchantContext.businessName,
        phone: merchantDetails?.phone ?? null,
        registeredAddress: merchantDetails?.registered_address,
        stateCode: merchantDetails?.state_code ?? null,
      });
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
    const resolvedSenderInfo = quotePayload.sender ?? senderInfo;

    const bookingRequest: BookingRequest = {
      orderId: data.orderId,
      quoteId: data.quoteId,
      providerRateId: quote.provider_rate_id,
      quoteMetadata: quote.provider_metadata,
      sender: resolvedSenderInfo,
      receiver: quotePayload.receiver,
      items: quotePayload.items,
      instructions: data.instructions,
    };

    if (!isShippingProviderCode(quote.provider)) {
      return NextResponse.json(
        { error: 'Invalid shipping provider in quote' },
        { status: 400 }
      );
    }
    const result = await shippingService.bookShipment(
      quote.provider,
      bookingRequest
    );

    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert(
        buildShipmentInsertPayload({
          orderId: data.orderId,
          merchantId,
          senderInfo: resolvedSenderInfo,
          receiver: quotePayload.receiver,
          items: quotePayload.items,
          quote,
          result,
        })
      )
      .select('id')
      .single();

    if (shipmentError) {
      console.error('Error creating shipment record:', shipmentError);
      return NextResponse.json(
        {
          error:
            'Shipment booked with provider but failed to save record. Contact support with tracking number: ' +
            result.trackingNumber,
          trackingNumber: result.trackingNumber,
        },
        { status: 500 }
      );
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        shipment_id: shipment?.id,
        shipping_status: 'processing',
        shipping_provider: result.provider,
        tracking_number: result.trackingNumber,
        selected_quote_id: data.quoteId,
        fulfillment_type: 'provider',
      })
      .eq('id', data.orderId)
      .eq('merchant_id', merchantId);

    if (orderUpdateError) {
      console.error(
        'Error updating order with shipment info:',
        orderUpdateError
      );
      return NextResponse.json(
        {
          error:
            'Shipment booked with provider but failed to update order. Contact support with tracking number: ' +
            result.trackingNumber,
          trackingNumber: result.trackingNumber,
        },
        { status: 500 }
      );
    }
    const { error: quoteUpdateError } = await supabase
      .from('shipping_quotes')
      .update({ used: true })
      .eq('id', data.quoteId)
      .eq('merchant_id', merchantId);

    if (quoteUpdateError) {
      console.error(
        'Error marking quote as used after successful shipment booking:',
        {
          error: quoteUpdateError,
          quoteId: data.quoteId,
          trackingNumber: result.trackingNumber,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        shipment: {
          id: shipment?.id,
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
