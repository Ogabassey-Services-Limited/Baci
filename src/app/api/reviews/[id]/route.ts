import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Single Review API
 *
 * GET /api/reviews/[id] - Get a single review
 * PATCH /api/reviews/[id] - Update review (moderate, respond)
 * DELETE /api/reviews/[id] - Delete a review
 */

interface ReviewUpdate {
  status?: 'pending' | 'approved' | 'rejected';
  merchantResponse?: string;
}

// GET - Fetch single review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: review, error } = await supabase
      .from('product_reviews')
      .select(`
        *,
        products:product_id (
          id,
          name,
          images
        )
      `)
      .eq('id', id)
      .single();

    if (error || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Review GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update review (moderate or respond)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as ReviewUpdate;
    const { status, merchantResponse } = body;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the review and verify ownership
    const { data: review, error: reviewError } = await supabase
      .from('product_reviews')
      .select('id, merchant_id')
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Verify user owns the merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', review.merchant_id)
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      updates.status = status;
    }

    if (merchantResponse !== undefined) {
      updates.merchant_response = merchantResponse || null;
      updates.merchant_response_at = merchantResponse ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Update the review
    const { data: updatedReview, error: updateError } = await supabase
      .from('product_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating review:', updateError);
      return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      review: updatedReview,
    });
  } catch (error) {
    console.error('Review PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the review and verify ownership
    const { data: review, error: reviewError } = await supabase
      .from('product_reviews')
      .select('id, merchant_id')
      .eq('id', id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Verify user owns the merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', review.merchant_id)
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete the review
    const { error: deleteError } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Review DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
