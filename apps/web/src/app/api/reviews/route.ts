import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { notifyNewReview } from '@/lib/expo-push';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { reviewSubmissionSchema } from '@/schemas/reviews';

/**
 * Product Reviews API
 *
 * GET /api/reviews?productId=xxx - Get reviews for a product (public)
 * GET /api/reviews?merchantId=xxx - Get all reviews for merchant (authenticated)
 * POST /api/reviews - Submit a new review
 */

// GET - Fetch reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const merchantId = searchParams.get('merchantId');
    const status = searchParams.get('status');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // If fetching for merchant dashboard (all statuses), require auth
    if (merchantId && status !== 'approved') {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify user owns or is staff of this merchant
      const merchantContext = await getMerchantForApiRequest(supabase, user.id);
      if (!merchantContext || merchantContext.merchantId !== merchantId) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      const access = toUserAccess(merchantContext);
      if (!hasPermission(access, 'orders', 'view')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let query = supabase.from('product_reviews').select(
      `
        *,
        products:product_id (
          id,
          name,
          images
        )
      `,
      { count: 'exact' }
    );

    if (productId) {
      query = query.eq('product_id', productId);
      // For public product page, only show approved reviews
      if (!merchantId) {
        query = query.eq('status', 'approved');
      }
    }

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
      if (status) {
        query = query.eq('status', status);
      }
    }

    if (searchParams.get('customerEmail')) {
      query = query.eq(
        'customer_email',
        searchParams.get('customerEmail')?.toLowerCase()
      );
    }

    const {
      data: reviews,
      error,
      count,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Get rating stats if fetching for a product
    let stats = null;
    if (productId) {
      const { data: statsData } = await supabase.rpc(
        'get_product_rating_stats',
        { p_product_id: productId }
      );

      if (statsData && statsData.length > 0) {
        stats = statsData[0];
      }
    }

    return NextResponse.json({
      reviews,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit a new review
export async function POST(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const rawBody = await request.json();
    const validationResult = reviewSubmissionSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      productId,
      merchantId,
      customerEmail,
      customerName,
      rating,
      title,
      body: reviewBody,
    } = validationResult.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, merchant_id, name')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if customer already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', productId)
      .eq('customer_email', customerEmail) // Already sanitized and lowercased by schema
      .single();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 }
      );
    }

    // Check for verified purchase
    let verifiedPurchase = false;
    let orderId: string | null = null;

    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', customerEmail) // Already sanitized
      .eq('merchant_id', merchantId)
      .in('payment_status', ['paid'])
      .limit(1);

    if (orders && orders.length > 0) {
      // Check if order contains this product
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orders[0].id)
        .eq('product_id', productId)
        .limit(1);

      if (orderItems && orderItems.length > 0) {
        verifiedPurchase = true;
        orderId = orders[0].id;
      }
    }

    // Insert the review
    const { data: review, error: insertError } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        merchant_id: merchantId,
        order_id: orderId,
        customer_email: customerEmail,
        customer_name: customerName || null,
        rating,
        title: title || null,
        body: reviewBody || null,
        status: 'pending',
        verified_purchase: verifiedPurchase,
      })
      // PERFORMANCE: Use explicit column selection instead of .select() to prevent overfetching full review rows on insertion
      .select(
        'id, product_id, merchant_id, order_id, customer_email, customer_name, rating, title, body, status, verified_purchase, created_at'
      )
      .single();

    if (insertError) {
      console.error('Error inserting review:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit review' },
        { status: 500 }
      );
    }

    // Notify merchant of new review (fire-and-forget)
    notifyNewReview(
      merchantId,
      product.name || 'Product',
      rating,
      customerName || 'A customer'
    ).catch((err) => console.error('Review notification failed:', err));

    return NextResponse.json({
      success: true,
      review,
      message:
        'Thank you for your review! It will be visible after moderation.',
    });
  } catch (error) {
    console.error('Reviews POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
