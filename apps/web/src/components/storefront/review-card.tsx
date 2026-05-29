'use client';

import { CheckCircle, MessageSquare, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { StarRating } from './star-rating';

interface Review {
  id: string;
  customer_name?: string;
  customer_email?: string | null;
  rating: number;
  title?: string;
  body?: string;
  verified_purchase: boolean;
  helpful_count: number;
  merchant_response?: string;
  merchant_response_at?: string;
  created_at: string;
}

interface ReviewCardProps {
  review: Review;
  className?: string;
}

export function ReviewCard({ review, className }: ReviewCardProps) {
  const { toast } = useToast();
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const displayName =
    review.customer_name ||
    review.customer_email?.split('@')[0] ||
    'Verified customer';
  const formattedDate = new Date(review.created_at).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  const handleHelpfulVote = async () => {
    if (hasVoted || isVoting) return;

    setIsVoting(true);

    try {
      // Use email from localStorage or generate session ID
      const voterIdentifier =
        localStorage.getItem('customerEmail') ||
        `session_${crypto.randomUUID()}`;

      const response = await fetch(`/api/reviews/${review.id}/helpful`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_identifier: voterIdentifier }),
      });

      const data = await response.json();

      if (response.status === 409) {
        setHasVoted(true);
        toast({
          title: 'Already Voted',
          description: 'You have already marked this review as helpful.',
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to vote');
      }

      setHelpfulCount(data.helpful_count);
      setHasVoted(true);
      toast({
        title: 'Thanks!',
        description: 'Your feedback helps others.',
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to submit vote. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className={cn('border-b pb-6 last:border-b-0', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StarRating rating={review.rating} size="sm" />
            {review.verified_purchase && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="w-3 h-3" />
                Verified Purchase
              </span>
            )}
          </div>

          {review.title && (
            <h4 className="font-semibold text-lg mb-1">{review.title}</h4>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="font-medium">{displayName}</span>
            <span>•</span>
            <span>{formattedDate}</span>
          </div>

          {review.body && (
            <p className="text-muted-foreground whitespace-pre-wrap">
              {review.body}
            </p>
          )}

          {/* Merchant Response */}
          {review.merchant_response && (
            <div className="mt-4 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <MessageSquare className="w-4 h-4" />
                Store Response
              </div>
              <p className="text-sm text-muted-foreground">
                {review.merchant_response}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleHelpfulVote}
          disabled={hasVoted || isVoting}
          className={cn('text-muted-foreground', hasVoted && 'text-primary')}
        >
          <ThumbsUp
            className={cn('w-4 h-4 mr-1', hasVoted && 'fill-current')}
          />
          Helpful ({helpfulCount})
        </Button>
      </div>
    </div>
  );
}
