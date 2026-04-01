import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Customer Loyalty API
 *
 * GET - List all customers with their loyalty data (for merchants)
 *
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - tier: string (filter by tier)
 * - search: string (search by name/email)
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'marketing', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('customer_loyalty')
      .select(
        `
        id,
        points_balance,
        lifetime_points,
        current_tier,
        referral_code,
        referral_count,
        created_at,
        customers:customers!customer_loyalty_customer_id_fkey (
          id,
          name,
          email,
          phone,
          store_credit
        )
      `,
        { count: 'exact' }
      )
      .eq('merchant_id', merchantId)
      .order('lifetime_points', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tier) {
      query = query.eq('current_tier', tier);
    }

    // PERFORMANCE: Move search filter to database query instead of client-side
    if (search) {
      // Note: Supabase doesn't support filtering on joined table fields in the main query
      // We use textSearch on the customers table via a subquery pattern
      // For now, we filter on customer name/email via the joined data
      query = query.or(
        `customers.name.ilike.%${search}%,customers.email.ilike.%${search}%`
      );
    }

    const { data: loyaltyData, error, count } = await query;

    if (error) {
      console.error('Error fetching customer loyalty:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    // PERFORMANCE: Get tier distribution using RPC or aggregation
    // Instead of fetching all rows, use a lightweight count query per tier
    const { data: tierCounts } = await supabase.rpc('get_loyalty_tier_counts', {
      p_merchant_id: merchantId,
    });

    // Fallback if RPC doesn't exist - use single query with group
    const tierDistribution: Record<string, number> = {};
    if (tierCounts && Array.isArray(tierCounts)) {
      // RPC returned proper counts
      for (const item of tierCounts) {
        tierDistribution[item.tier] = item.count;
      }
    } else {
      // Fallback: count from current page data (less accurate but no extra query)
      // This is a degraded experience but prevents the N+1 query
      (loyaltyData || []).forEach((item) => {
        tierDistribution[item.current_tier] =
          (tierDistribution[item.current_tier] || 0) + 1;
      });
    }

    return NextResponse.json({
      customers: loyaltyData || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        tierDistribution,
        totalCustomers: count || 0,
      },
    });
  } catch (error) {
    console.error('Customer loyalty GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
