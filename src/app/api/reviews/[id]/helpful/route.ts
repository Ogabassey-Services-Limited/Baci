import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/reviews/[id]/helpful
 * Vote a review as helpful
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id: reviewId } = await context.params;
        const body = await request.json();
        const voterIdentifier = body.voter_identifier; // email or session ID

        if (!voterIdentifier) {
            return NextResponse.json(
                { error: 'voter_identifier is required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

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
            return NextResponse.json({ error: 'Cannot vote on unapproved reviews' }, { status: 400 });
        }

        // Check if already voted
        const { data: existingVote } = await supabase
            .from('review_helpful_votes')
            .select('id')
            .eq('review_id', reviewId)
            .eq('voter_identifier', voterIdentifier)
            .single();

        if (existingVote) {
            return NextResponse.json(
                { error: 'You have already voted on this review', alreadyVoted: true },
                { status: 409 }
            );
        }

        // Add vote
        const { error: insertError } = await supabase
            .from('review_helpful_votes')
            .insert({
                review_id: reviewId,
                voter_identifier: voterIdentifier
            });

        if (insertError) {
            console.error('Error adding helpful vote:', insertError);
            return NextResponse.json({ error: 'Failed to add vote' }, { status: 500 });
        }

        // Get updated count
        const { data: updatedReview } = await supabase
            .from('product_reviews')
            .select('helpful_count')
            .eq('id', reviewId)
            .single();

        return NextResponse.json({
            success: true,
            helpful_count: updatedReview?.helpful_count || 0
        });
    } catch (error) {
        console.error('Helpful vote POST error:', error);
        return NextResponse.json({ error: 'Failed to add vote' }, { status: 500 });
    }
}
