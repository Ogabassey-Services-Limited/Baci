import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { historyQuerySchema } from '@/schemas/vtu';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = historyQuerySchema.safeParse({
      merchantSlug: searchParams.get('merchantSlug'),
      type: searchParams.get('type') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { merchantSlug, type, limit } = parsed.data;

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    let customer = null;

    const { data: customerByUserId } = await supabase
      .from('customers')
      .select('id, user_id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (customerByUserId) {
      customer = customerByUserId;
    } else if (auth.user.email) {
      const { data: customerByEmail } = await supabase
        .from('customers')
        .select('id, user_id')
        .eq('merchant_id', merchant.id)
        .eq('email', auth.user.email)
        .maybeSingle();

      if (customerByEmail) {
        customer = customerByEmail;

        if (!customerByEmail.user_id) {
          void supabase
            .from('customers')
            .update({ user_id: auth.user.id })
            .eq('id', customerByEmail.id);
        }
      }
    }

    if (!customer) {
      return NextResponse.json({ transactions: [] });
    }

    let query = supabase
      .from('vtu_transactions')
      .select(
        'id, created_at, type, status, amount, network_provider, phone_number, biller_name, biller_item_code, customer_identifier, customer_name, request_reference, error_message, customer_cashback'
      )
      .eq('merchant_id', merchant.id)
      .eq('customer_id', customer.id);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, error: transactionsError } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transactionsError) {
      console.error('Failed to fetch customer VTU history:', transactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: (transactions ?? []).map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount) || 0,
        customer_cashback:
          transaction.customer_cashback != null
            ? Number(transaction.customer_cashback)
            : null,
      })),
    });
  } catch (error) {
    console.error('Customer VTU history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
