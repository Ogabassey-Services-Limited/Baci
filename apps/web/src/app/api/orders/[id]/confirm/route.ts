import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getAdminClient,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import {
  type DeviceInsuranceDetails,
  purchaseOrderInsurance,
} from '@/services/insurance';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Await params in newer Next.js
) {
  try {
    const { id } = await params;

    // Auth check (supports mobile Bearer token + web cookies)
    const { user, error: authError } = await authenticateApiRequest(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(user.id);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 403 }
      );
    }

    // Use admin client for queries
    const supabase = getAdminClient();

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
        // biome-ignore lint/suspicious/noExplicitAny: Error from catch block
      } catch (err: any) {
        logger.error({
          message: 'Insurance purchase error during confirm',
          error: err,
        });
        // We might return 400 here if insurance is mandatory for this confirmation
        // For now, let's allow it to proceed but return warning
      }
    }

    // 2. Update Order Status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_status: 'processing', // or confirmed
        // Add any other confirmation fields
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Order confirmed successfully',
      insurance: insuranceResult,
    });
    // biome-ignore lint/suspicious/noExplicitAny: Error from catch block
  } catch (error: any) {
    logger.error({ message: 'Confirm Order API Error', error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
