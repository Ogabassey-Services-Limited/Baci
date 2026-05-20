import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { generatePaymentAccount } from '@/lib/paystack';

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
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id: orderId } = await params;
    const body = await request.json();

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

    // 3. Get merchant details for virtual account
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant details not found' },
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
      .eq('merchant_id', merchantId)
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
      .eq('merchant_id', merchantId);

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

    // 7. Create Paystack DVA for payment collection (optional but recommended)
    //    Uses generatePaymentAccount which handles existing customer DVAs idempotently
    let virtualAccount = null;
    try {
      const nameParts = (order.customer_name || 'Customer').trim().split(' ');
      const dvaResult = await generatePaymentAccount({
        email: order.customer_email || `${orderId}@orders.usebaci.com`,
        firstName: nameParts[0] || 'Customer',
        lastName: nameParts.slice(1).join(' ') || 'User',
        phone: '',
        orderId,
      });

      if (dvaResult.success) {
        const { error: insertError } = await supabase
          .from('order_payment_accounts')
          .insert({
            order_id: orderId,
            account_number: dvaResult.data.account_number,
            bank_name: dvaResult.data.bank_name,
            account_name: dvaResult.data.account_name,
            provider: 'paystack',
          });

        if (insertError) {
          // Handle duplicate key conflicts as idempotent success
          const { data: existingAccount, error: existingAccountError } =
            await supabase
              .from('order_payment_accounts')
              .select('account_number, bank_name, account_name')
              .eq('order_id', orderId)
              .eq('provider', 'paystack')
              .maybeSingle();

          if (existingAccountError) {
            logger.error({
              message: 'Database error fetching existing payment account',
              error: existingAccountError,
              orderId,
            });
            return NextResponse.json(
              { error: 'Failed to create or fetch payment account' },
              { status: 500 }
            );
          }

          if (existingAccount) {
            logger.info({
              message:
                'Order payment account already exists, treating as idempotent success',
              orderId,
            });
            virtualAccount = {
              account_number: existingAccount.account_number,
              bank_name: existingAccount.bank_name,
              account_name: existingAccount.account_name,
            };
          } else {
            logger.error({
              message: 'Failed to insert order payment account',
              error: insertError,
              orderId,
            });
            return NextResponse.json(
              { error: 'Failed to create payment account' },
              { status: 500 }
            );
          }
        } else {
          virtualAccount = {
            account_number: dvaResult.data.account_number,
            bank_name: dvaResult.data.bank_name,
            account_name: dvaResult.data.account_name,
          };
        }
      }
    } catch (vaError) {
      // Non-blocking: Log but don't fail the request
      logger.warn({
        message: 'Could not create DVA for credit order',
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
