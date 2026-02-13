'use client';

import { Loader2, MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ReviewCard } from './review-card';
import { ReviewForm } from './review-form';
import { RatingSummary, StarRating } from './star-rating';

interface Review {
  id: string;
  customer_name?: string;
  customer_email: string;
  rating: number;
  title?: string;
  body?: string;
  verified_purchase: boolean;
  helpful_count: number;
  merchant_response?: string;
  merchant_response_at?: string;
  created_at: string;
}

interface ReviewStats {
  averageRating: number;
  reviewCount: number;
  distribution: Record<string, number>;
}

interface ReviewsSectionProps {
  productId: string;
  productName: string;
  className?: string;
}

export function ReviewsSection({
  productId,
  productName,
  className,
}: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [showForm, setShowForm] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchReviews = async (reset = false) => {
    const currentOffset = reset ? 0 : offset;

    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetch(
        `/api/reviews?product_id=${productId}&sort=${sortBy}&limit=10&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();

      if (reset) {
        setReviews(data.reviews);
        setOffset(10);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
        setOffset((prev) => prev + 10);
      }

      setStats(data.stats);
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    fetchReviews(true);
  }, [productId, sortBy]);

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setOffset(0);
  };

  const handleReviewSuccess = () => {
    setShowForm(false);
    // Don't refresh immediately since review is pending
  };

  if (isLoading) {
    return (
      <div className={cn('py-8', className)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <section className={cn('py-8', className)} id="reviews">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Customer Reviews</h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'outline' : 'default'}
        >
          {showForm ? 'Cancel' : 'Write a Review'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-8">
          <ReviewForm
            productId={productId}
            productName={productName}
            onSuccess={handleReviewSuccess}
          />
        </div>
      )}

      {stats && stats.reviewCount > 0 ? (
        <>
          <RatingSummary
            averageRating={stats.averageRating}
            reviewCount={stats.reviewCount}
            distribution={stats.distribution}
            className="mb-8 p-6 bg-muted/30 rounded-lg"
          />

          <div className="flex items-center justify-between mb-6">
            <span className="text-muted-foreground">
              Showing {reviews.length} of {stats.reviewCount} reviews
            </span>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="highest">Highest Rated</SelectItem>
                <SelectItem value="lowest">Lowest Rated</SelectItem>
                <SelectItem value="helpful">Most Helpful</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => fetchReviews(false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Load More Reviews
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <MessageSquareText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
          <p className="text-muted-foreground mb-4">
            Be the first to review {productName}
          </p>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>Write a Review</Button>
          )}
        </div>
      )}
    </section>
  );
}

// Compact version for product cards
interface ProductRatingProps {
  averageRating: number;
  reviewCount: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProductRating({
  averageRating,
  reviewCount,
  size = 'sm',
  className,
}: ProductRatingProps) {
  if (reviewCount === 0) return null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <StarRating rating={averageRating} size={size} />
      <span className="text-sm text-muted-foreground">({reviewCount})</span>
    </div>
  );
}
