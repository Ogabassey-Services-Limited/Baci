/**
 * Shipping Tracking API
 * Track a shipment by tracking number
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { shippingService } from '@/lib/shipping';
import type {
  NormalizedShipmentStatus,
  ShippingProviderCode,
} from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// GET /api/shipping/track/[trackingNumber] - Track a shipment
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const { trackingNumber } = await params;

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'Tracking number required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Try to find shipment in our database first (to get provider)
    const { data: shipment } = await supabase
      .from('shipments')
      .select(
        'id, provider, order_id, carrier_name, receiver_address, estimated_delivery_days'
      )
      .eq('tracking_number', trackingNumber)
      .single();

    // biome-ignore lint/suspicious/noExplicitAny: External API response
    let trackingResult: any;

    if (shipment?.provider) {
      // Track with known provider
      trackingResult = await shippingService.trackShipment(
        trackingNumber,
        shipment.provider as ShippingProviderCode
      );
    } else {
      // Try all providers
      trackingResult = await shippingService.trackShipment(trackingNumber);
    }

    // Update shipment status in database if found
    if (shipment) {
      await supabase
        .from('shipments')
        .update({
          status: trackingResult.status,
          current_location: trackingResult.events?.[0]?.location,
          estimated_delivery_at:
            trackingResult.estimatedDelivery?.toISOString(),
          delivered_at: trackingResult.actualDelivery?.toISOString(),
          tracking_events: trackingResult.events,
          last_tracked_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      // Update order shipping status
      const orderStatusMap: Record<NormalizedShipmentStatus, string> = {
        pending: 'pending',
        booked: 'shipped',
        pickup_scheduled: 'shipped',
        picked_up: 'shipped',
        in_transit: 'shipped',
        out_for_delivery: 'shipped',
        delivered: 'delivered',
        cancelled: 'cancelled',
        failed: 'failed',
        returned: 'returned',
      };

      await supabase
        .from('orders')
        .update({
          shipping_status:
            orderStatusMap[trackingResult.status as NormalizedShipmentStatus] ||
            'processing',
        })
        .eq('id', shipment.order_id);
    }

    return NextResponse.json({
      trackingNumber,
      carrier: trackingResult.carrierName,
      provider: trackingResult.provider,
      status: trackingResult.status,
      statusLabel: getStatusLabel(trackingResult.status),
      estimatedDelivery: trackingResult.estimatedDelivery?.toISOString(),
      actualDelivery: trackingResult.actualDelivery?.toISOString(),
      // biome-ignore lint/suspicious/noExplicitAny: External API response is loosely typed
      events: trackingResult.events.map((e: any) => ({
        status: e.status,
        description: e.description,
        location: e.location,
        timestamp: e.timestamp.toISOString(),
      })),
      // Include additional shipment details if we have them
      shipment: shipment
        ? {
            id: shipment.id,
            orderId: shipment.order_id,
            receiverCity: shipment.receiver_address?.city,
            receiverState: shipment.receiver_address?.state,
            estimatedDays: shipment.estimated_delivery_days,
          }
        : undefined,
    });
  } catch (error) {
    console.error('Error tracking shipment:', error);

    // Return a friendly error message
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error:
            'Shipment not found. Please check the tracking number and try again.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to track shipment' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusLabel(status: NormalizedShipmentStatus): string {
  const labels: Record<NormalizedShipmentStatus, string> = {
    pending: 'Order Received',
    booked: 'Shipment Booked',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    failed: 'Delivery Failed',
    returned: 'Returned to Sender',
  };
  return labels[status] || status;
}
