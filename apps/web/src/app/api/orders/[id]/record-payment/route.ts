import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { amount, payment_method, reference, notes } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const adminSupabase = createAdminClient();

    // 1. Authenticate Merchant
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // 2. Fetch Order & Existing Transactions
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('order_id', id)
      .eq('status', 'success');

    // 3. Calculate Totals
    const currentPaid =
      transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
    const walletUsed = Number(order.wallet_amount_used) || 0;
    const totalPaidBefore = currentPaid + walletUsed;
    const newPaid = totalPaidBefore + Number(amount);
    const orderTotal = Number(order.total) || 0;
    const remainingBalance = Math.max(0, orderTotal - newPaid);

    // 4. Create Transaction
    const { error: transactionError } = await adminSupabase
      .from('transactions')
      .insert({
        merchant_id: merchant.id,
        order_id: id,
        transaction_type: 'payment',
        amount: amount,
        currency: order.currency || 'NGN',
        status: 'success', // Manual payments are successful immediately
        gateway: 'manual',
        gateway_reference: reference || `MAN-${Date.now()}`,
        description: notes || `Manual payment (${payment_method})`,
        metadata: {
          payment_method: payment_method || 'manual',
          recorded_by: user.email,
        },
      });

    if (transactionError) {
      console.error('Failed to create manual transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    // 5. Update Order Status
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic update object
    const updates: any = {};

    // Payment Status Logic
    if (newPaid >= orderTotal) {
      updates.payment_status = 'paid';
      // Auto-advance shipping if pending
      if (order.shipping_status === 'pending') {
        updates.shipping_status = 'processing';
      }
    } else {
      updates.payment_status = 'partially_paid';
    }

    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminSupabase
        .from('orders')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update order status:', updateError);
        // Note: Transaction was already created, so we don't fail the request entirely,
        // but it's an inconsistent state. Ideally would use a stored procedure/transaction.
      }
    }

    return NextResponse.json({
      success: true,
      amount_paid: amount,
      new_balance: remainingBalance,
      updated_status: updates,
    });
    // biome-ignore lint/suspicious/noExplicitAny: Catch error type
  } catch (error: any) {
    console.error('Error in record-payment:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
