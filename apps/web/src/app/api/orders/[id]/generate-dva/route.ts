import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { generatePaymentAccount } from '@/lib/paystack';
import { orderIdParamsSchema } from '@/schemas/orders';

/**
 * POST /api/orders/[id]/generate-dva
 * Creates a Paystack DVA (Dedicated Virtual Account) for invoice payment collection.
 * Idempotent: returns existing DVA if one already exists for this order.
 * The verified Paystack webhook creates the transaction only after money arrives.
 * Supports both cookie-based auth (web) and Bearer token auth (mobile).
 *
 * Uses generatePaymentAccount which checks for existing DVAs before creating new ones.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    const parsedParams = orderIdParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid order ID', code: 'INVALID_ORDER_ID' },
        { status: 400 }
      );
    }
    const orderId = parsedParams.data.id;

    // 2. Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;

    // 3. Fetch order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, order_number, total, amount_paid, customer_name, customer_email, customer_phone, payment_status, merchant_id'
      )
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 4. Guard: order must not already be fully paid
    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Order is already paid' },
        { status: 400 }
      );
    }

    // 5. Check for existing DVA in our DB (idempotent)
    const { data: existingVba, error: existingVbaError } = await supabase
      .from('order_payment_accounts')
      .select('account_number, bank_name, account_name')
      .eq('order_id', orderId)
      .eq('provider', 'paystack')
      .maybeSingle();

    if (existingVbaError) {
      logger.error({
        message: 'Database error checking existing VBA',
        error: existingVbaError,
      });
      return NextResponse.json(
        { error: 'Failed to verify existing payment account' },
        { status: 500 }
      );
    }

    if (existingVba) {
      return NextResponse.json({
        success: true,
        virtualAccount: existingVba,
        existing: true,
      });
    }

    // 6. Parse customer name into first/last
    const nameParts = (order.customer_name || 'Customer').trim().split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // 6b. Get a valid phone number — wema-bank requires it for DVA creation.
    let phone = order.customer_phone || '';
    if (!phone) {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('phone')
        .eq('id', merchantId)
        .maybeSingle();

      if (merchantError) {
        logger.error({
          message: 'Database error fetching merchant phone',
          error: merchantError,
        });
      }
      phone = merchant?.phone || '08000000000';
    }

    // 7. Create Paystack DVA via generatePaymentAccount
    //    This checks for existing customer DVAs first (GET) before creating new ones (POST)
    logger.info({
      message: 'Creating Paystack DVA for order',
      orderId,
      customerEmail: order.customer_email,
      firstName,
      lastName,
    });

    const dvaResult = await generatePaymentAccount({
      email: order.customer_email || `${orderId}@orders.usebaci.com`,
      firstName,
      lastName,
      phone,
      orderId,
    });

    if (!dvaResult.success) {
      logger.error({
        message: 'DVA creation failed',
        orderId,
        error: dvaResult.error,
      });
      return NextResponse.json(
        { error: `DVA creation failed: ${dvaResult.error}` },
        { status: 502 }
      );
    }

    // 8. Store in order_payment_accounts
    const payableAmount = Math.max(
      Number(order.total) - Number(order.amount_paid || 0),
      0
    );
    const { error: insertError } = await supabase
      .from('order_payment_accounts')
      .upsert(
        {
          order_id: orderId,
          account_number: dvaResult.data.account_number,
          bank_name: dvaResult.data.bank_name,
          account_name: dvaResult.data.account_name,
          provider: 'paystack',
          payable_amount: payableAmount,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'order_id,provider' }
      );

    if (insertError) {
      logger.error({
        message: 'Failed to store DVA in database',
        orderId,
        error: insertError,
      });
      return NextResponse.json(
        {
          error: 'Failed to save automatic confirmation account',
          code: 'PAYMENT_ACCOUNT_PERSIST_FAILED',
        },
        { status: 500 }
      );
    }

    logger.info({
      message: 'Paystack DVA created for order',
      orderId,
      bankName: dvaResult.data.bank_name,
    });

    return NextResponse.json({
      success: true,
      virtualAccount: {
        account_number: dvaResult.data.account_number,
        bank_name: dvaResult.data.bank_name,
        account_name: dvaResult.data.account_name,
      },
      existing: false,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error({ message: 'Generate DVA API error', error: errorMessage });
    return NextResponse.json(
      { error: `DVA creation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
