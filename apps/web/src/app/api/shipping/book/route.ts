/**
 * Shipping Booking API
 * Book a shipment with the selected provider
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { shippingService } from '@/lib/shipping';
import { deriveMerchantLocation } from '@/lib/shipping/order-shipment-booking-utils';
import type {
  BookingRequest,
  ShippingProviderCode,
} from '@/lib/shipping/types';
import { SHIPPING_PROVIDER_CODES } from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';
import { BookingRequestSchema } from '@/schemas/shipping';
import { buildShipmentInsertPayload } from './shipment-insert-payload';

function isShippingProviderCode(value: string): value is ShippingProviderCode {
  return (SHIPPING_PROVIDER_CODES as readonly string[]).includes(value);
}

// =============================================================================
// POST /api/shipping/book - Book a shipment
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
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

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Permission check
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'orders', 'fulfill')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const body = await request.json();

    // Validate request
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

    // Verify the order belongs to this merchant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, merchant_id, shipping_status')
      .eq('id', data.orderId)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if already shipped
    // Check if already shipped or being processed
    if (
      ['shipped', 'delivered', 'processing'].includes(order.shipping_status)
    ) {
      return NextResponse.json(
        { error: 'Order has already been shipped or is being processed' },
        { status: 400 }
      );
    }

    // Get the selected quote
    const { data: quote, error: quoteError } = await supabase
      .from('shipping_quotes')
      .select(
        'id, provider_code, provider_rate_id, provider_metadata, expires_at, price, currency, estimated_days'
      )
      .eq('id', data.quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found or expired' },
        { status: 404 }
      );
    }

    // Check if quote is expired
    if (new Date(quote.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Quote has expired. Please get a new quote.' },
        { status: 400 }
      );
    }

    // Build sender info
    let senderInfo = data.sender;
    if (!senderInfo) {
      // Fetch merchant address/phone details for sender fallback
      const { data: merchantDetails } = await supabase
        .from('merchants')
        .select('business_name, business_address, phone')
        .eq('id', merchantId)
        .single();

      const location = deriveMerchantLocation(
        merchantDetails?.business_address
      );
      senderInfo = {
        name:
          merchantDetails?.business_name ||
          merchantContext.businessName ||
          'Merchant',
        phone: merchantDetails?.phone || '',
        address: location.address,
        city: location.city,
        state: location.state,
        country: 'Nigeria',
        countryCode: 'NG',
      };
    }

    // Build booking request
    const bookingRequest: BookingRequest = {
      orderId: data.orderId,
      quoteId: data.quoteId,
      providerRateId: quote.provider_rate_id,
      quoteMetadata: quote.provider_metadata,
      sender: senderInfo,
      receiver: {
        ...data.receiver,
        country: data.receiver.country || 'Nigeria',
        countryCode: data.receiver.countryCode || 'NG',
      },
      items: data.items,
      instructions: data.instructions,
    };

    // Book the shipment
    if (!isShippingProviderCode(quote.provider_code)) {
      return NextResponse.json(
        { error: 'Invalid shipping provider in quote' },
        { status: 400 }
      );
    }
    const provider: ShippingProviderCode = quote.provider_code;
    const result = await shippingService.bookShipment(provider, bookingRequest);

    // Create shipment record in database
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert(
        buildShipmentInsertPayload({
          orderId: data.orderId,
          merchantId,
          senderInfo,
          receiver: data.receiver,
          items: data.items,
          quote,
          result,
        })
      )
      // PERFORMANCE: Use explicit column selection instead of .select() to prevent overfetching full shipment rows on insertion, as only the ID is needed below
      .select('id')
      .single();

    if (shipmentError) {
      console.error('Error creating shipment record:', shipmentError);
      // Return error - inconsistent state is worse than failed booking
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

    // Update order with shipment info
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

    // Mark quote as used
    const { error: quoteUpdateError } = await supabase
      .from('shipping_quotes')
      .update({ used: true })
      .eq('id', data.quoteId);

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
    console.error('Error booking shipment:', error);
    return NextResponse.json(
      {
        error: 'Failed to book shipment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
