import { customAlphabet } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { createDedicatedVirtualAccount } from '@/lib/agentic/paystack';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { calculatePlatformFee } from '@/lib/paystack';

const nanoidUppercase = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  12
);

/**
 * POST /api/orders/[id]/generate-dva
 * Creates a Paystack DVA (Dedicated Virtual Account) for invoice payment collection.
 * Idempotent: returns existing DVA if one already exists for this order.
 * Also creates a pending transaction so the Paystack webhook can match the payment.
 * Supports both cookie-based auth (web) and Bearer token auth (mobile).
 *
 * Uses the agentic paystack module which has bank fallback (wema-bank → titan-paycom).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // 1. Auth check (supports mobile Bearer token + web cookies)
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        'id, order_number, total, customer_name, customer_email, customer_phone, payment_status, merchant_id'
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
    const { data: existingVba } = await supabase
      .from('order_payment_accounts')
      .select('account_number, bank_name, account_name')
      .eq('order_id', orderId)
      .maybeSingle();

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
    // Fallback: customer phone → merchant phone → placeholder
    let phone = order.customer_phone || '';
    if (!phone) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('phone')
        .eq('id', merchantId)
        .single();
      phone = merchant?.phone || '08000000000';
    }

    // 7. Create Paystack DVA via agentic module (wema-bank → titan-paycom fallback)
    logger.info({
      message: 'Creating Paystack DVA for order',
      orderId,
      customerEmail: order.customer_email,
      firstName,
      lastName,
    });

    const dvaResult = await createDedicatedVirtualAccount({
      email: order.customer_email || `${orderId}@orders.usebaci.com`,
      first_name: firstName,
      last_name: lastName,
      phone,
    });

    // 8. Store in order_payment_accounts
    const { error: insertError } = await supabase
      .from('order_payment_accounts')
      .insert({
        order_id: orderId,
        account_number: dvaResult.account_number,
        bank_name: dvaResult.bank_name,
        account_name: dvaResult.account_name,
        provider: 'paystack',
      });

    if (insertError) {
      logger.error({
        message: 'Failed to store DVA in database',
        orderId,
        error: insertError,
      });
    }

    // 9. Create a pending transaction record so the Paystack webhook can match
    const reference = `BAC-${nanoidUppercase()}`;
    const amountInKobo = Math.round(Number(order.total) * 100);
    const fees = calculatePlatformFee(amountInKobo);

    const { error: txnError } = await supabase.rpc(
      'create_payment_transaction',
      {
        p_merchant_id: merchantId,
        p_order_id: orderId,
        p_amount: Number(order.total),
        p_currency: 'NGN',
        p_gateway: 'paystack',
        p_reference: reference,
        p_platform_fee: fees.platformFee / 100,
        p_merchant_amount: fees.merchantAmount / 100,
        p_customer_email: order.customer_email || '',
        p_customer_name: order.customer_name || '',
        p_session_id: null,
      }
    );

    if (txnError) {
      logger.warn({
        message: 'Failed to create transaction record for DVA',
        orderId,
        error: txnError,
      });
    }

    logger.info({
      message: 'Paystack DVA created for order',
      orderId,
      accountNumber: dvaResult.account_number,
      bankName: dvaResult.bank_name,
      reference,
    });

    return NextResponse.json({
      success: true,
      virtualAccount: {
        account_number: dvaResult.account_number,
        bank_name: dvaResult.bank_name,
        account_name: dvaResult.account_name,
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
