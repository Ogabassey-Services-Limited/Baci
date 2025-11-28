import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface ReviewInput {
    product_id: string;
    customer_email: string;
    customer_name?: string;
    rating: number;
    title?: string;
    body?: string;
}

/**
 * GET /api/reviews
 * Fetch reviews for a product (public - only approved reviews)
 *
 * Query params:
 * - product_id: UUID (required)
 * - limit: number (default 10, max 50)
 * - offset: number (default 0)
 * - sort: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful' (default 'newest')
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('product_id');
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
        const offset = parseInt(searchParams.get('offset') || '0');
        const sort = searchParams.get('sort') || 'newest';

        if (!productId) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Build query for approved reviews
        let query = supabase
            .from('product_reviews')
            .select('*', { count: 'exact' })
            .eq('product_id', productId)
            .eq('status', 'approved');

        // Apply sorting
        switch (sort) {
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'highest':
                query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
                break;
            case 'lowest':
                query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
                break;
            case 'helpful':
                query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: reviews, error, count } = await query;

        if (error) {
            console.error('Error fetching reviews:', error);
            return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
        }

        // Get rating stats using the function
        const { data: statsData } = await supabase.rpc('get_product_rating_stats', {
            p_product_id: productId
        });

        const stats = statsData?.[0] || {
            average_rating: 0,
            review_count: 0,
            rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
        };

        return NextResponse.json({
            reviews: reviews || [],
            stats: {
                averageRating: parseFloat(stats.average_rating) || 0,
                reviewCount: parseInt(stats.review_count) || 0,
                distribution: stats.rating_distribution
            },
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (count || 0) > offset + limit
            }
        });
    } catch (error) {
        console.error('Reviews GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }
}

/**
 * POST /api/reviews
 * Submit a new review for a product
 */
export async function POST(request: NextRequest) {
    try {
        const body: ReviewInput = await request.json();

        // Validate required fields
        if (!body.product_id || !body.customer_email || !body.rating) {
            return NextResponse.json(
                { error: 'product_id, customer_email, and rating are required' },
                { status: 400 }
            );
        }

        // Validate rating range
        if (body.rating < 1 || body.rating > 5) {
            return NextResponse.json(
                { error: 'Rating must be between 1 and 5' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.customer_email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get product to find merchant_id
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, merchant_id')
            .eq('id', body.product_id)
            .single();

        if (productError || !product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        // Check if customer already reviewed this product
        const { data: existingReview } = await supabase
            .from('product_reviews')
            .select('id')
            .eq('product_id', body.product_id)
            .eq('customer_email', body.customer_email)
            .single();

        if (existingReview) {
            return NextResponse.json(
                { error: 'You have already reviewed this product' },
                { status: 409 }
            );
        }

        // Check for verified purchase
        const { data: verifiedData } = await supabase.rpc('check_verified_purchase', {
            p_product_id: body.product_id,
            p_customer_email: body.customer_email
        });

        const isVerified = verifiedData?.[0]?.is_verified || false;
        const orderId = verifiedData?.[0]?.order_id || null;

        // Create the review
        const { data: review, error: insertError } = await supabase
            .from('product_reviews')
            .insert({
                product_id: body.product_id,
                merchant_id: product.merchant_id,
                order_id: orderId,
                customer_email: body.customer_email,
                customer_name: body.customer_name || null,
                rating: body.rating,
                title: body.title || null,
                body: body.body || null,
                verified_purchase: isVerified,
                status: 'pending' // Reviews start as pending for moderation
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating review:', insertError);
            return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            review,
            message: 'Your review has been submitted and is pending approval.'
        }, { status: 201 });
    } catch (error) {
        console.error('Reviews POST error:', error);
        return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }
}
