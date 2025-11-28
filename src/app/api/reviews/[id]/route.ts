import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/reviews/[id]
 * Get a single review by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: review, error } = await supabase
            .from('product_reviews')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !review) {
            return NextResponse.json({ error: 'Review not found' }, { status: 404 });
        }

        return NextResponse.json({ review });
    } catch (error) {
        console.error('Review GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 });
    }
}

/**
 * PATCH /api/reviews/[id]
 * Update a review (for merchant moderation)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
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

        // Verify review belongs to merchant
        const { data: review } = await supabase
            .from('product_reviews')
            .select('id, merchant_id')
            .eq('id', id)
            .single();

        if (!review || review.merchant_id !== merchant.id) {
            return NextResponse.json({ error: 'Review not found' }, { status: 404 });
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {};

        // Status update (approve/reject)
        if (body.status && ['pending', 'approved', 'rejected'].includes(body.status)) {
            updateData.status = body.status;
        }

        // Merchant response
        if (typeof body.merchant_response === 'string') {
            updateData.merchant_response = body.merchant_response || null;
            updateData.merchant_response_at = body.merchant_response ? new Date().toISOString() : null;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data: updatedReview, error: updateError } = await supabase
            .from('product_reviews')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating review:', updateError);
            return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
        }

        return NextResponse.json({ review: updatedReview });
    } catch (error) {
        console.error('Review PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
    }
}

/**
 * DELETE /api/reviews/[id]
 * Delete a review (merchant only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
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

        // Delete review (RLS will verify ownership)
        const { error: deleteError } = await supabase
            .from('product_reviews')
            .delete()
            .eq('id', id)
            .eq('merchant_id', merchant.id);

        if (deleteError) {
            console.error('Error deleting review:', deleteError);
            return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Review DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }
}
