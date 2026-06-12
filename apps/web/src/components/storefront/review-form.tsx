'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { StarRating } from './star-rating';

interface ReviewFormProps {
  productId: string;
  productName: string;
  onSuccess?: () => void;
  className?: string;
}

interface SubmitReviewPayload {
  productId: string;
  customerEmail: string;
  customerName: string;
  rating: number;
  title: string;
  body: string;
}

type SubmitReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Module-scope submission helper so the component body stays free of
 * try/catch/finally statements, which block React Compiler memoization.
 */
async function submitReview(
  payload: SubmitReviewPayload
): Promise<SubmitReviewResult> {
  try {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: payload.productId,
        customer_email: payload.customerEmail,
        customer_name: payload.customerName || undefined,
        rating: payload.rating,
        title: payload.title || undefined,
        body: payload.body || undefined,
      }),
    });

    const data: { error?: string } = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || 'Failed to submit review' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to submit review',
    };
  }
}

function getStoredCustomerEmail(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('customerEmail') ?? '';
}

export function ReviewForm({
  productId,
  productName,
  onSuccess,
  className,
}: ReviewFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [customerName, setCustomerName] = useState('');
  // Seed from localStorage in the initializer (runs once per mount) instead
  // of a mount effect, which would set state synchronously after commit.
  const [customerEmail, setCustomerEmail] = useState(getStoredCustomerEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating.',
        variant: 'destructive',
      });
      return;
    }

    if (!customerEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const result = await submitReview({
      productId,
      customerEmail,
      customerName,
      rating,
      title,
      body,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitted(true);
    toast({
      title: 'Review Submitted!',
      description:
        'Thank you for your feedback. Your review is pending approval.',
    });

    // Store email for future use
    localStorage.setItem('customerEmail', customerEmail);

    onSuccess?.();
  };

  if (isSubmitted) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="size-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Thank You!</h3>
            <p className="text-muted-foreground">
              Your review has been submitted and is pending approval.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Write a Review</CardTitle>
        <CardDescription>
          Share your experience with {productName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Your Rating *</Label>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRatingChange={setRating}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="review-email">Email *</Label>
              <Input
                id="review-email"
                type="email"
                placeholder="your@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-name">Name (optional)</Label>
              <Input
                id="review-name"
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-title">Review Title (optional)</Label>
            <Input
              id="review-title"
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-body">Your Review (optional)</Label>
            <Textarea
              id="review-body"
              placeholder="Tell others about your experience with this product..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            aria-busy={isSubmitting}
          >
            {isSubmitting && (
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Submit Review
          </Button>
          <p className="sr-only" role="status" aria-live="polite">
            {isSubmitting ? 'Submitting review.' : ''}
          </p>

          <p className="text-xs text-muted-foreground text-center">
            Reviews are moderated and may take time to appear. Verified
            purchases will be marked with a badge.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
