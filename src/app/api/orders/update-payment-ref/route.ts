import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/orders/update-payment-ref
 *
 * Updates an order with payment reference from external payment gateways.
 * Used by Credit Direct and other popup-based payment providers.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentRef, gateway } = await request.json();

    if (!orderId || !paymentRef) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, paymentRef' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get current order notes
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('notes')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Parse existing notes and add payment reference
    let existingNotes = {};
    try {
      existingNotes = JSON.parse(order.notes || '{}');
    } catch {
      existingNotes = {};
    }

    const updatedNotes = {
      ...existingNotes,
      [`${gateway || 'payment'}TransactionId`]: paymentRef,
      paymentRefUpdatedAt: new Date().toISOString(),
    };

    // Update order with payment reference
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        notes: JSON.stringify(updatedNotes),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order payment ref:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update payment ref error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
