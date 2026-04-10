import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { notifyOrderStatusChange } from '@/lib/expo-push';
import { ORDER_COLUMNS, ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { bookOrderShipment } from '@/lib/shipping/book-order-shipment';
import {
  claimOrderShipmentBooking,
  clearOrderShipmentBookingLock,
} from '@/lib/shipping/order-shipment-booking-lock';
import {
  isShippingProviderCode,
  OrderShipmentBookingError,
} from '@/lib/shipping/order-shipment-booking-utils';

const RELEASEABLE_BOOKING_ERROR_CODES = new Set([
  'ORDER_NOT_FOUND',
  'MISSING_SHIPPING_QUOTE',
  'INVALID_SHIPPING_PROVIDER',
  'MISSING_ORDER_ITEMS',
  'QUOTE_NOT_FOUND',
  'QUOTE_REFRESH_UNAVAILABLE',
  'QUOTE_REFRESH_FAILED',
  'MERCHANT_NOT_FOUND',
  'INCOMPLETE_SHIPPING_ADDRESS',
  'EXISTING_SHIPMENT_LOOKUP_FAILED',
  'INCOMPLETE_EXISTING_SHIPMENT',
]);

function shouldReleaseBookingLock(
  error: unknown
): error is OrderShipmentBookingError {
  return (
    error instanceof OrderShipmentBookingError &&
    RELEASEABLE_BOOKING_ERROR_CODES.has(error.code)
  );
}

// GET /api/orders/[id] - Get a single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate request (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;

    // Get order (ensure it belongs to this merchant)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Unexpected error in GET /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    // Authenticate request (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;
    let shipmentBookingLockToken: string | null = null;

    // Verify order belongs to this merchant and get current status
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select(
        'id, order_number, shipping_status, payment_status, is_credit_order, customer_id, selected_quote_id, shipping_provider, tracking_number, shipment_id'
      )
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (checkError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Extract updatable fields
    const { payment_status, shipping_status, notes, shipping_address } = body;

    // Validate: Cannot move to 'processing' unless paid or is_credit_order
    if (
      shipping_status === 'processing' &&
      existingOrder.shipping_status === 'pending' &&
      existingOrder.payment_status !== 'paid' &&
      !existingOrder.is_credit_order
    ) {
      return NextResponse.json(
        {
          error:
            'Order must be paid before processing. Use the credit order flow to ship unpaid orders.',
          code: 'PAYMENT_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (
      shipping_status === 'shipped' &&
      existingOrder.shipping_status === 'pending'
    ) {
      return NextResponse.json(
        {
          error: 'Order must be processing before it can be marked as shipped.',
          code: 'ORDER_NOT_READY_TO_SHIP',
        },
        { status: 400 }
      );
    }

    if (
      shipping_status === 'shipped' &&
      !existingOrder.tracking_number &&
      !existingOrder.shipment_id &&
      isShippingProviderCode(existingOrder.shipping_provider) &&
      !existingOrder.selected_quote_id
    ) {
      return NextResponse.json(
        {
          error:
            'This provider order does not have a saved shipping quote. Please re-quote before marking it as shipped.',
          code: 'MISSING_SHIPPING_QUOTE',
        },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (payment_status !== undefined) {
      updates.payment_status = payment_status;
    }
    if (shipping_status !== undefined) {
      updates.shipping_status = shipping_status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (shipping_address !== undefined) {
      updates.shipping_address = shipping_address;
    }

    if (
      shipping_status === 'shipped' &&
      !existingOrder.tracking_number &&
      !existingOrder.shipment_id &&
      isShippingProviderCode(existingOrder.shipping_provider) &&
      existingOrder.selected_quote_id
    ) {
      const bookingClaim = await claimOrderShipmentBooking(
        supabase,
        merchantId,
        id
      );

      if (bookingClaim.status === 'in_progress') {
        return NextResponse.json(
          {
            error: 'Shipment booking is already in progress for this order.',
            code: 'SHIPMENT_BOOKING_IN_PROGRESS',
          },
          { status: 409 }
        );
      }

      if (bookingClaim.status === 'claimed') {
        shipmentBookingLockToken = bookingClaim.lockToken;

        try {
          const booking = await bookOrderShipment(supabase, merchantId, id);
          updates.shipping_provider = booking.provider;
          updates.selected_quote_id = booking.quoteId;
          updates.shipment_id = booking.shipmentId;
          updates.tracking_number = booking.trackingNumber;
          if (shipmentBookingLockToken) {
            updates.shipment_booking_lock_token = null;
            updates.shipment_booking_started_at = null;
          }
        } catch (error) {
          if (shipmentBookingLockToken && shouldReleaseBookingLock(error)) {
            try {
              await clearOrderShipmentBookingLock(
                supabase,
                merchantId,
                id,
                shipmentBookingLockToken
              );
            } catch (lockError) {
              console.error(
                'Failed to release shipment booking lock after booking error:',
                lockError
              );
            }
          }

          throw error;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update order
    let updateQuery = supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (shipmentBookingLockToken) {
      updateQuery = updateQuery.eq(
        'shipment_booking_lock_token',
        shipmentBookingLockToken
      );
    }

    const { data: order, error: updateError } = await updateQuery
      .select(ORDER_COLUMNS)
      .single();

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    // Send push notification if shipping status changed
    if (
      shipping_status !== undefined &&
      shipping_status !== existingOrder.shipping_status &&
      existingOrder.customer_id
    ) {
      // Get customer's user_id for push notification
      const { data: customer } = await supabase
        .from('customers')
        .select('user_id')
        .eq('id', existingOrder.customer_id)
        .single();

      if (customer?.user_id) {
        // Fire and forget - don't block the response
        notifyOrderStatusChange(
          customer.user_id,
          id,
          existingOrder.order_number,
          shipping_status
        ).catch((err) => {
          console.error('Failed to send order status push notification:', err);
        });
      }
    }

    return NextResponse.json({ order });
  } catch (error) {
    if (error instanceof OrderShipmentBookingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Unexpected error in PATCH /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
