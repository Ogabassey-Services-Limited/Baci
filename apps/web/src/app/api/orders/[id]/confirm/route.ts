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
  confirmOrderRouteParamsSchema,
  deviceInsuranceDetailsSchema,
} from '@/schemas/order-confirm';
import {
  type DeviceInsuranceDetails,
  purchaseOrderInsurance,
} from '@/services/insurance';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Await params in newer Next.js
) {
  try {
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

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    const supabase = auth.supabase;

    const routeParams = confirmOrderRouteParamsSchema.safeParse(await params);
    if (!routeParams.success) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }
    const { id } = routeParams.data;

    // Parse body for device details
    const body = await request.json();
    const shouldPurchaseInsurance =
      body.imei !== undefined || body.devicePhotos !== undefined;
    const deviceDetailsResult = shouldPurchaseInsurance
      ? deviceInsuranceDetailsSchema.safeParse(body)
      : null;
    if (deviceDetailsResult && !deviceDetailsResult.success) {
      return NextResponse.json(
        { error: 'Invalid insurance details' },
        { status: 400 }
      );
    }

    // 1. Update Order Status
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

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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

    // 2. Trigger Insurance Purchase after the order status transition succeeds.
    // External side effects must not run until cancellation clamps/null updates
    // have been excluded.
    let insuranceResult = null;
    let insuranceError: string | null = null;

    if (deviceDetailsResult?.success) {
      const deviceDetails: DeviceInsuranceDetails = deviceDetailsResult.data;

      try {
        insuranceResult = await purchaseOrderInsurance(id, deviceDetails);
      } catch (err: unknown) {
        logger.error({
          message: 'Insurance purchase error during confirm',
          error: err,
        });
        insuranceError =
          err instanceof Error ? err.message : 'Insurance purchase failed';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order confirmed successfully',
      insurance: insuranceResult,
      ...(insuranceError ? { insuranceError } : {}),
    });
  } catch (error: unknown) {
    logger.error({ message: 'Confirm Order API Error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
