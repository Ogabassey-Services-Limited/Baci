import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

function mapTransaction(tx: Record<string, unknown>) {
  return {
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
  };
}

/**
 * GET /api/wallet/transactions
 * Get wallet transaction history
 *
 * Supports both offset-based (page/limit) and cursor-based (cursor/limit) pagination.
 * Cursor pagination is preferred for sequential access — O(1) regardless of depth.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { searchParams } = new URL(request.url);

    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const type = searchParams.get('type'); // credit, debit, withdrawal, payout
    const _cursor = searchParams.get('cursor'); // ISO timestamp for keyset pagination
    const offset = (page - 1) * limit;

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Specific columns only (avoids fetching unnecessary data)
    const columns =
      'id, type, amount, balance_after, status, description, source_type, source_id, transfer_reference, transfer_status, created_at';

    if (_cursor) {
      // Keyset pagination — O(1) regardless of page depth
      let cursorQuery = supabase
        .from('wallet_transactions')
        .select(columns)
        .eq('merchant_id', merchantId)
        .lt('created_at', _cursor)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (type) {
        cursorQuery = cursorQuery.eq('type', type);
      }

      const { data: transactions, error } = await cursorQuery;

      if (error) {
        console.error('Failed to get transactions:', error);
        return NextResponse.json(
          { error: 'Failed to get transactions' },
          { status: 500 }
        );
      }

      const rows = transactions ?? [];
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1].created_at : null;

      return NextResponse.json({
        transactions: items.map(mapTransaction),
        pagination: { limit, next_cursor: nextCursor, has_more: hasMore },
      });
    }

    // Offset pagination (backward compatible)
    let offsetQuery = supabase
      .from('wallet_transactions')
      .select(columns, { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      offsetQuery = offsetQuery.eq('type', type);
    }

    const { data: transactions, error, count } = await offsetQuery;

    if (error) {
      console.error('Failed to get transactions:', error);
      return NextResponse.json(
        { error: 'Failed to get transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transactions: (transactions ?? []).map(mapTransaction),
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
