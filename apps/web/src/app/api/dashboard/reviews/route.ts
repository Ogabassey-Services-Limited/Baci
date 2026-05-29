import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { sanitizeLikePattern, sanitizeSearchQuery } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

const DASHBOARD_REVIEWS_SELECT = `
  id,
  product_id,
  merchant_id,
  order_id,
  customer_email,
  customer_name,
  rating,
  title,
  body,
  status,
  verified_purchase,
  helpful_count,
  merchant_response,
  merchant_response_at,
  created_at,
  updated_at,
  products:product_id (
    name,
    slug
  )
`;

/**
 * GET /api/dashboard/reviews
 * Fetch all reviews for the authenticated merchant's products
 *
 * Query params:
 * - status: 'all' | 'pending' | 'approved' | 'rejected'
 * - search: string (search in title, body, customer name/email)
 * - limit: number (default 50)
 * - offset: number (default 0)
 *
 * PERFORMANCE NOTE: For optimal search performance, ensure these indexes exist:
 * - CREATE INDEX idx_product_reviews_merchant_id ON product_reviews(merchant_id);
 * - CREATE INDEX idx_product_reviews_status ON product_reviews(status);
 * - CREATE INDEX idx_product_reviews_title_trgm ON product_reviews USING gin(title gin_trgm_ops);
 * - CREATE INDEX idx_product_reviews_customer_name_trgm ON product_reviews USING gin(customer_name gin_trgm_ops);
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

    // Get merchant (supports owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const searchRaw = searchParams.get('search') || '';
    // SECURITY: Sanitize search input to prevent SQL injection
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : '';
    const limit = Math.min(
      Number.parseInt(searchParams.get('limit') || '50', 10),
      100
    );
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('product_reviews')
      .select(DASHBOARD_REVIEWS_SELECT, { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply search filter with sanitized pattern
    if (search?.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(
        `title.ilike.%${sanitizedPattern}%,body.ilike.%${sanitizedPattern}%,customer_name.ilike.%${sanitizedPattern}%,customer_email.ilike.%${sanitizedPattern}%`
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
