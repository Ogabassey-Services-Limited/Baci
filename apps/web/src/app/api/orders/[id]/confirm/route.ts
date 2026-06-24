import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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

function isStrictPastDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  if (!yearText || !monthText || !dayText) return false;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const dobTime = Date.UTC(year, month - 1, day);
  const dob = new Date(dobTime);

  if (
    dob.getUTCFullYear() !== year ||
    dob.getUTCMonth() !== month - 1 ||
    dob.getUTCDate() !== day
  ) {
    return false;
  }

  const now = new Date();
  const todayTime = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return dobTime < todayTime;
}

const strictPastDateOnlySchema = z.string().refine(isStrictPastDateOnly, {
  message: 'dateOfBirth must be a valid past date',
});

const deviceInsuranceDetailsSchema = z.object({
  imei: z.string().trim().min(1).max(64),
  serialNumber: z.string().trim().min(1).max(128),
  deviceColor: z.string().trim().min(1).max(64),
  deviceModel: z.string().trim().min(1).max(128),
  deviceMake: z.string().trim().min(1).max(128),
  deviceType: z.enum(['Phone', 'Laptop', 'Others']),
  deviceValue: z.coerce.number().positive().finite(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  devicePhotos: z.object({
    about: z.url(),
  }),
  customerPhoto: z.url().optional(),
  // Real policyholder KYC is required for insurance — no placeholder data may
  // reach the insurer.
  gender: z.enum(['Male', 'Female']),
  dateOfBirth: strictPastDateOnlySchema,
});

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
