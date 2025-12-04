import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/wallet/transactions
 * Get wallet transaction history
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { searchParams } = new URL(request.url);

    const page = Number.parseInt(searchParams.get('page') || '1');
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '20'), 100);
    const type = searchParams.get('type'); // credit, debit, withdrawal, payout
    const offset = (page - 1) * limit;

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Failed to get transactions:', error);
      return NextResponse.json(
        { error: 'Failed to get transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        balanceAfter: Number(tx.balance_after),
        status: tx.status,
        description: tx.description,
        sourceType: tx.source_type,
        sourceId: tx.source_id,
        transferReference: tx.transfer_reference,
        transferStatus: tx.transfer_status,
        createdAt: tx.created_at,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Wallet transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
