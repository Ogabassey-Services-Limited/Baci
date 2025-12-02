import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/dashboard/reviews
 * Fetch all reviews for the authenticated merchant's products
 *
 * Query params:
 * - status: 'all' | 'pending' | 'approved' | 'rejected'
 * - search: string (search in title, body, customer name/email)
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '50', 10),
      100
    );
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('product_reviews')
      .select(
        `
                *,
                products:product_id (
                    name,
                    slug
                )
            `,
        { count: 'exact' }
      )
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply search filter
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,body.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
      );
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviews: reviews || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Dashboard reviews GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
