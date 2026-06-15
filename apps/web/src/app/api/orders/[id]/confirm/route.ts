import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import {
  type DeviceInsuranceDetails,
  purchaseOrderInsurance,
} from '@/services/insurance';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Await params in newer Next.js
) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    const { id } = await params;

    // Auth check (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 403 }
      );
    }

    const supabase = auth.supabase;

    // Parse body for device details
    const body = await request.json();
    const {
      imei,
      serialNumber,
      deviceColor,
      deviceModel,
      deviceMake,
      deviceType,
      deviceValue,
      purchaseDate,
      devicePhotos,
      customerPhoto, // Optional
    } = body;

    // TODO: Verify order ownership

    // 1. Trigger Insurance Purchase (if strictly required)
    // We do this BEFORE confirming to ensure we don't confirm if purchase fails?
    // OR we do it loosely and log failures.
    // Decision: Do it and return success/partial success.

    let insuranceResult = null;

    // Check if we have insurance inputs (only if assurance is expected)
    if (imei && devicePhotos) {
      const deviceDetails: DeviceInsuranceDetails = {
        imei,
        serialNumber,
        deviceColor,
        deviceModel,
        deviceMake,
        deviceType,
        deviceValue,
        purchaseDate,
        devicePhotos,
        customerPhoto,
      };

      try {
        insuranceResult = await purchaseOrderInsurance(id, deviceDetails);
      } catch (err: unknown) {
        logger.error({
          message: 'Insurance purchase error during confirm',
          error: err,
        });
        // We might return 400 here if insurance is mandatory for this confirmation
        // For now, let's allow it to proceed but return warning
      }
    }

    // 2. Update Order Status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_status: 'processing', // or confirmed
        // Add any other confirmation fields
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select('id, shipping_status, cancelled_at')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    // The prevent_cancelled_order_reopen trigger clamped this confirm: the
    // order is cancelled and cannot be advanced. File a reconciliation row so
    // ops can reconcile, and report the no-op without confirming.
    if (isOrderClampedAsCancelled(updatedOrder)) {
      await handlePaymentForCancelledOrder({
        gatewayReference: null,
        order: updatedOrder ?? { id },
        reason:
          'Merchant confirm attempted on an order cancelled by the customer',
        transactionId: null,
      });

      return NextResponse.json(
        {
          error: 'Order was cancelled and cannot be confirmed',
          code: 'ORDER_CANCELLED',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order confirmed successfully',
      insurance: insuranceResult,
    });
  } catch (error: unknown) {
    logger.error({ message: 'Confirm Order API Error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
