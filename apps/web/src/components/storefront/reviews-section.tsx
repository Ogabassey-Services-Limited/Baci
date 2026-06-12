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

interface ReviewsResponse {
  reviews: Review[];
  stats: ReviewStats;
  pagination: { hasMore: boolean };
}

const REVIEWS_PAGE_SIZE = 10;

// Module-scope helper keeps the throw/try out of the component body so React
// Compiler can memoize it (react-doctor `todo` bailouts).
async function fetchProductReviews(
  productId: string,
  sortBy: string,
  offset: number
): Promise<ReviewsResponse> {
  const response = await fetch(
    `/api/reviews?product_id=${productId}&sort=${sortBy}&limit=${REVIEWS_PAGE_SIZE}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch reviews');
  }

  return (await response.json()) as ReviewsResponse;
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
  const [prevProductId, setPrevProductId] = useState(productId);

  // Show the loading state for a new product during render instead of via an
  // effect (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (productId !== prevProductId) {
    setPrevProductId(productId);
    setIsLoading(true);
  }

  useEffect(() => {
    let cancelled = false;

    fetchProductReviews(productId, sortBy, 0)
      .then((data) => {
        if (cancelled) return;
        setReviews(data.reviews);
        setOffset(REVIEWS_PAGE_SIZE);
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error fetching reviews:', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId, sortBy]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    fetchProductReviews(productId, sortBy, offset)
      .then((data) => {
        setReviews((prev) => [...prev, ...data.reviews]);
        setOffset((prev) => prev + REVIEWS_PAGE_SIZE);
        setStats(data.stats);
        setHasMore(data.pagination.hasMore);
      })
      .catch((error) => {
        console.error('Error fetching reviews:', error);
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  };

  const handleSortChange = (value: string) => {
    setIsLoading(true);
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
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore && (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                )}
                Load More Reviews
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <MessageSquareText className="size-12 text-muted-foreground mx-auto mb-4" />
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
