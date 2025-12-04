import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

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
      .eq('merchant_id', merchant.id)
      .order('lifetime_points', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tier) {
      query = query.eq('current_tier', tier);
    }

    const { data: loyaltyData, error, count } = await query;

    if (error) {
      console.error('Error fetching customer loyalty:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data' },
        { status: 500 }
      );
    }

    // Filter by search if provided (client-side for simplicity)
    let filteredData = loyaltyData || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((item) => {
        const customer = item.customers as {
          name?: string;
          email?: string;
        } | null;
        return (
          customer?.name?.toLowerCase().includes(searchLower) ||
          customer?.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Get tier distribution
    const { data: tierCounts } = await supabase
      .from('customer_loyalty')
      .select('current_tier')
      .eq('merchant_id', merchant.id);

    const tierDistribution: Record<string, number> = {};
    (tierCounts || []).forEach((item) => {
      tierDistribution[item.current_tier] =
        (tierDistribution[item.current_tier] || 0) + 1;
    });

    return NextResponse.json({
      customers: filteredData,
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
