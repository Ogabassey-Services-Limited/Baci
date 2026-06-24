/**
 * Shipping Tracking API
 * Track a shipment by tracking number
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { maybeNotifyActivateProtection } from '@/lib/insurance/notify-activate-protection';
import { shippingService } from '@/lib/shipping';
import type {
  NormalizedShipmentStatus,
  ShippingProviderCode,
  TrackingResult,
} from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';
import { trackingParamsSchema } from '@/schemas/shipping-tracking';

// =============================================================================
// POST /api/shipping/track/[trackingNumber] - Fetch current shipment tracking
// =============================================================================

type SupabaseServerClient = ReturnType<typeof createClient>;

type ShipmentLookupResult = {
  carrier_name: string | null;
  estimated_delivery_days: number | null;
  id: string;
  order_id: string;
  provider: string | null;
  receiver_address?: {
    city?: string | null;
    state?: string | null;
  } | null;
};

const ORDER_STATUS_BY_SHIPMENT_STATUS: Record<
  NormalizedShipmentStatus,
  string
> = {
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

export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to refresh shipment tracking.' },
    { headers: { Allow: 'POST' }, status: 405 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const parsedParams = trackingParamsSchema.safeParse(await params);

    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Tracking number required' },
        { status: 400 }
      );
    }

    const { trackingNumber } = parsedParams.data;
    const csrf = await checkCsrfProtection(request);
    if (!csrf.valid) {
      return (
        csrf.response ??
        NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
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

    let trackingResult: TrackingResult;

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

    if (shipment) {
      await persistTrackingResult({
        shipment: shipment as ShipmentLookupResult,
        supabase,
        trackingResult,
      });
    }

    return NextResponse.json({
      trackingNumber,
      carrier: trackingResult.carrierName,
      provider: trackingResult.provider,
      status: trackingResult.status,
      statusLabel: getStatusLabel(trackingResult.status),
      estimatedDelivery: trackingResult.estimatedDelivery?.toISOString(),
      actualDelivery: trackingResult.actualDelivery?.toISOString(),
      events: trackingResult.events.map((e) => ({
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

async function persistTrackingResult({
  shipment,
  supabase,
  trackingResult,
}: {
  shipment: ShipmentLookupResult;
  supabase: SupabaseServerClient;
  trackingResult: TrackingResult;
}) {
  const { error: shipmentUpdateError } = await supabase
    .from('shipments')
    .update({
      status: trackingResult.status,
      current_location: trackingResult.events[0]?.location,
      estimated_delivery_at: trackingResult.estimatedDelivery?.toISOString(),
      delivered_at: trackingResult.actualDelivery?.toISOString(),
      tracking_events: trackingResult.events,
      last_tracked_at: new Date().toISOString(),
    })
    .eq('id', shipment.id);

  if (shipmentUpdateError) {
    console.error('Error updating shipment tracking snapshot:', {
      error: shipmentUpdateError,
      shipmentId: shipment.id,
    });
    // Customer tracking should return the live carrier result even when RLS
    // denies opportunistic snapshot persistence for the request-scoped client.
    return;
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      shipping_status:
        ORDER_STATUS_BY_SHIPMENT_STATUS[trackingResult.status] || 'processing',
    })
    .eq('id', shipment.order_id);

  if (orderUpdateError) {
    console.error('Error updating order shipping status from tracking:', {
      error: orderUpdateError,
      orderId: shipment.order_id,
    });
    return;
  }

  // On delivery, nudge the customer to activate any pending gadget cover.
  if (ORDER_STATUS_BY_SHIPMENT_STATUS[trackingResult.status] === 'delivered') {
    maybeNotifyActivateProtection(shipment.order_id).catch((err) => {
      console.error('Failed to send activate-protection push:', err);
    });
  }
}

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
