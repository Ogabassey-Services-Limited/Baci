import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import {
  type OrderReceiptBankDetails,
  orderReceiptBankDetailsRequestSchema,
} from '@/schemas/order-receipt-bank-details';

// GET /api/storefront/orders/[id]/receipt-bank-details
//
// S0-B order-scoped receipt/bank boundary. Returns ONLY the bounded receipt
// projection for the merchant that owns THIS order, authorized by one of:
//   (a) a guest capability   -> `?token=<order tracking_token>`
//   (b) the owning customer   -> a signed-in session (auth.uid)
//   (c) the merchant owner/staff -> a signed-in session (has_merchant_access)
//
// All authorization is enforced inside the SECURITY DEFINER RPC
// `get_order_receipt_bank_details`; this route never uses the service-role
// client. Unauthorized / unknown orders return 404 without confirming the
// order's existence (403 is intentionally collapsed into 404 to avoid leaking).

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('token') ?? undefined;

    const parsed = orderReceiptBankDetailsRequestSchema.safeParse({
      orderId: id,
      token,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { headers: NO_STORE_HEADERS, status: 400 }
      );
    }

    const { orderId, token: capabilityToken } = parsed.data;
    const supabase = await createClient();

    // Without a guest capability token the caller must be a signed-in owner.
    // Short-circuit here so an anonymous, token-less request never reaches the
    // RPC (which would fail closed anyway) and gets a clear 401.
    if (!capabilityToken) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication or a tracking token is required' },
          { headers: NO_STORE_HEADERS, status: 401 }
        );
      }
    }

    const { data, error } = await supabase.rpc(
      'get_order_receipt_bank_details',
      { p_order_id: orderId, p_tracking_token: capabilityToken ?? null }
    );

    if (error) {
      logger.error({
        message: 'receipt-bank-details RPC failed',
        code: error.code,
      });
      return NextResponse.json(
        { error: 'Failed to load receipt details' },
        { headers: NO_STORE_HEADERS, status: 500 }
      );
    }

    const details = Array.isArray(data)
      ? (data[0] as OrderReceiptBankDetails | undefined)
      : null;

    if (!details) {
      // No capability, no ownership, or unknown order — fail closed, no leak.
      return NextResponse.json(
        { error: 'Order not found' },
        { headers: NO_STORE_HEADERS, status: 404 }
      );
    }

    return NextResponse.json(details, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logger.error({ message: 'receipt-bank-details unexpected error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { headers: NO_STORE_HEADERS, status: 500 }
    );
  }
}
