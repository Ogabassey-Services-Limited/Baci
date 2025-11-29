/**
 * Shipping Cancellation API
 * Cancel a shipment by shipment ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { shippingService } from '@/lib/shipping';
import type { ShippingProviderCode } from '@/lib/shipping/types';
import { isValidUuid } from '@/lib/sanitize';

// =============================================================================
// POST /api/shipping/cancel/[shipmentId] - Cancel a shipment
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shipmentId: string }> }
) {
  try {
    const { shipmentId } = await params;

    if (!shipmentId || !isValidUuid(shipmentId)) {
      return NextResponse.json(
        { error: 'Valid shipment ID required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, provider, provider_shipment_id, order_id, status, merchant_id')
      .eq('id', shipmentId)
      .eq('merchant_id', merchant.id)
      .single();

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      );
    }

    // Check if shipment can be cancelled
    const nonCancellableStatuses = ['delivered', 'cancelled', 'returned'];
    if (nonCancellableStatuses.includes(shipment.status)) {
      return NextResponse.json(
        { error: `Cannot cancel shipment with status: ${shipment.status}` },
        { status: 400 }
      );
    }

    // Ensure this shipment is cancellable via a provider
    if (!shipment.provider || !shipment.provider_shipment_id) {
      return NextResponse.json(
        { error: 'This shipment cannot be cancelled via a provider' },
        { status: 400 }
      );
    }

    // Cancel with provider
    const result = await shippingService.cancelShipment(
      shipment.provider as ShippingProviderCode,
      shipment.provider_shipment_id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Failed to cancel shipment' },
        { status: 400 }
      );
    }

    // Update shipment status
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        refund_amount: result.refundAmount,
      })
      .eq('id', shipmentId);

    if (updateError) {
      console.error('Error updating shipment status:', updateError);
      return NextResponse.json(
        { error: 'Shipment cancelled with provider but failed to update local status' },
        { status: 500 }
      );
    }

    // Update order
    await supabase
      .from('orders')
      .update({
        shipping_status: 'cancelled',
      })
      .eq('id', shipment.order_id);

    return NextResponse.json({
      success: true,
      message: result.message || 'Shipment cancelled successfully',
      refundAmount: result.refundAmount,
    });

  } catch (error) {
    console.error('Error cancelling shipment:', error);
    return NextResponse.json(
      { error: 'Failed to cancel shipment' },
      { status: 500 }
    );
  }
}
