import { type NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/anon';

/**
 * Review Helpful Vote API
 *
 * POST /api/reviews/[id]/helpful - Vote a review as helpful
 */

interface HelpfulVoteRequest {
  voterIdentifier: string; // email or session ID
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params;
    const body = (await request.json()) as HelpfulVoteRequest;
    const { voterIdentifier } = body;

    if (!voterIdentifier) {
      return NextResponse.json(
        { error: 'voterIdentifier is required' },
        { status: 400 }
      );
    }

    // Public endpoint: use anon client so mobile callers do not depend on cookies.
    const supabase = createAnonClient();

    // Check if review exists and is approved
    const { data: review, error: reviewError } = await supabase
      .from('product_reviews')
      .select('id, status')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.status !== 'approved') {
      return NextResponse.json(
        { error: 'Cannot vote on non-approved reviews' },
        { status: 400 }
      );
    }

    // Check if already voted
    const { data: existingVote } = await supabase
      .from('review_helpful_votes')
      .select('id')
      .eq('review_id', reviewId)
      .eq('voter_identifier', voterIdentifier.toLowerCase())
      .single();

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this review', alreadyVoted: true },
        { status: 409 }
      );
    }

    // Insert vote (trigger will update helpful_count)
    const { error: insertError } = await supabase
      .from('review_helpful_votes')
      .insert({
        review_id: reviewId,
        voter_identifier: voterIdentifier.toLowerCase(),
      });

    if (insertError) {
      console.error('Error inserting vote:', insertError);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    // Get updated helpful count
    const { data: updatedReview } = await supabase
      .from('product_reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    return NextResponse.json({
      success: true,
      helpfulCount: updatedReview?.helpful_count || 0,
    });
  } catch (error) {
    console.error('Helpful vote error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
