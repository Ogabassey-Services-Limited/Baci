import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { walletTransactionsQuerySchema } from '@/schemas/wallet-transactions-query';

/**
 * GET /api/wallet/transactions
 * Get wallet transaction history
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parseResult = walletTransactionsQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      type: searchParams.get('type') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error:
            parseResult.error.issues[0]?.message ?? 'Invalid query parameters',
        },
        { status: 400 }
      );
    }

    const { page, limit, type } = parseResult.data;
    const offset = (page - 1) * limit;

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Permission check
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'analytics', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Build query
    let query = supabase
      .from('wallet_transactions')
      // PERFORMANCE: Use explicit column selection instead of .select('*') to prevent overfetching full rows
      .select(
        'id, type, amount, balance_after, status, description, source_type, source_id, transfer_reference, transfer_status, created_at',
        { count: 'exact' }
      )
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const {
      data: transactions,
      error,
      count,
    } = await query.range(offset, offset + limit - 1);

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
