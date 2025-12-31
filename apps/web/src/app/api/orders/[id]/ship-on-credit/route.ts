import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createVirtualBankAccount } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/orders/[id]/ship-on-credit
 * Allows merchants to ship orders on credit (unpaid) with notes.
 * Optionally creates a virtual account for payment collection.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 3. Get order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, order_number, total, customer_name, customer_email, payment_status, shipping_status'
      )
      .eq('id', orderId)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 4. Validate order is not already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Order is already paid. No need for credit shipping.' },
        { status: 400 }
      );
    }

    // 5. Extract credit notes from body
    const creditNotes = body.credit_notes || body.notes || '';

    // 6. Update order to mark as credit and move to processing
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        is_credit_order: true,
        credit_notes: creditNotes,
        shipping_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('merchant_id', merchant.id);

    if (updateError) {
      logger.error({
        message: 'Failed to update order for credit shipping',
        error: updateError,
      });
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    // 7. Create virtual account for payment collection (optional but recommended)
    let virtualAccount = null;
    try {
      const accountResult = await createVirtualBankAccount({
        accountName: `${order.customer_name} - Order ${order.order_number}`,
        customerEmail: order.customer_email,
        amount: order.total,
        orderId: orderId,
        merchantId: merchant.id,
      });

      if (accountResult.success && accountResult.data) {
        // Store virtual account in database
        await supabase.from('order_payment_accounts').insert({
          order_id: orderId,
          account_number: accountResult.data.accountNumber,
          bank_name: accountResult.data.bankName,
          account_name: accountResult.data.accountName,
          provider: 'korapay',
          expires_at: accountResult.data.expiresAt,
        });
        virtualAccount = accountResult.data;
      }
    } catch (vaError) {
      // Non-blocking: Log but don't fail the request
      logger.warn({
        message: 'Could not create virtual account for credit order',
        error: vaError,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Order confirmed for credit shipping',
      order: {
        id: orderId,
        order_number: order.order_number,
        shipping_status: 'processing',
        is_credit_order: true,
      },
      virtualAccount,
    });
  } catch (error) {
    logger.error({ message: 'Ship on credit API error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
