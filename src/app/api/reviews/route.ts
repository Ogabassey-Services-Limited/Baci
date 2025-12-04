import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Product Reviews API
 *
 * GET /api/reviews?productId=xxx - Get reviews for a product (public)
 * GET /api/reviews?merchantId=xxx - Get all reviews for merchant (authenticated)
 * POST /api/reviews - Submit a new review
 */

interface ReviewSubmission {
  productId: string;
  merchantId: string;
  customerEmail: string;
  customerName?: string;
  rating: number;
  title?: string;
  body?: string;
}

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

      // Verify user owns this merchant
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('id', merchantId)
        .eq('user_id', user.id)
        .single();

      if (!merchant) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
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
    const body = (await request.json()) as ReviewSubmission;
    const {
      productId,
      merchantId,
      customerEmail,
      customerName,
      rating,
      title,
      body: reviewBody,
    } = body;

    // Validate required fields
    if (!productId || !merchantId || !customerEmail || !rating) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: productId, merchantId, customerEmail, rating',
        },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check if product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, merchant_id')
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
      .eq('customer_email', customerEmail.toLowerCase())
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
      .eq('customer_email', customerEmail.toLowerCase())
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
        customer_email: customerEmail.toLowerCase(),
        customer_name: customerName || null,
        rating,
        title: title || null,
        body: reviewBody || null,
        status: 'pending',
        verified_purchase: verifiedPurchase,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting review:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit review' },
        { status: 500 }
      );
    }

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
