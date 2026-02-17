/**
 * Reviews Hook
 * Fetches product reviews from the API
 *
 * 2026 Best Practice: Zod validation for API responses
 */

import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';
import {
  MarkReviewHelpfulResponseSchema,
  parseApiResponse,
  type Review,
  type ReviewStats,
  ReviewsApiResponseSchema,
} from '@/lib/validation';

const log = createLogger('Reviews');

// Re-export types for consumers
export type { Review, ReviewStats } from '@/lib/validation';

interface UseReviewsOptions {
  productId: string;
  limit?: number;
}

interface UseReviewsReturn {
  reviews: Review[];
  stats: ReviewStats | null;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_LIMIT = 10;

export function useReviews({
  productId,
  limit = DEFAULT_LIMIT,
}: UseReviewsOptions): UseReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const apiUrl = Constants.expoConfig?.extra?.apiUrl;

  const fetchReviews = useCallback(
    async (pageNum: number, append = false) => {
      if (!productId || !apiUrl) {
        setIsLoading(false);
        return;
      }

      try {
        if (!append) {
          setIsLoading(true);
        }

        const response = await fetch(
          `${apiUrl}/api/reviews?productId=${productId}&status=approved&page=${pageNum}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch reviews');
        }

        const rawData = await response.json();

        // 2026 Best Practice: Validate API response with Zod
        const validatedData = parseApiResponse(
          ReviewsApiResponseSchema,
          rawData,
          'reviews API'
        );

        if (!validatedData) {
          // Fallback to raw data if validation fails (graceful degradation)
          log.warn('Reviews API response validation failed, using raw data');
          const rawReviews = Array.isArray(rawData?.reviews)
            ? rawData.reviews
                .filter(
                  (r: unknown): r is Record<string, unknown> =>
                    r != null && typeof r === 'object'
                )
                .map((r: Record<string, unknown>) => ({
                  ...r,
                  rating: typeof r.rating === 'number' ? r.rating : 0,
                  comment: typeof r.comment === 'string' ? r.comment : '',
                  customer_name:
                    typeof r.customer_name === 'string'
                      ? r.customer_name
                      : 'Anonymous',
                }))
            : [];
          if (append) {
            setReviews((prev) => [...prev, ...rawReviews]);
          } else {
            setReviews(rawReviews as Review[]);
          }
          if (
            rawData?.stats &&
            typeof rawData.stats === 'object' &&
            typeof rawData.stats.average === 'number'
          ) {
            setStats(rawData.stats);
          }
          const totalPages = rawData?.pagination?.totalPages || 1;
          setHasMore(pageNum < totalPages);
        } else {
          // Use validated data
          if (append) {
            setReviews((prev) => [...prev, ...validatedData.reviews]);
          } else {
            setReviews(validatedData.reviews);
          }

          if (validatedData.stats) {
            setStats(validatedData.stats);
          }

          // Check if there are more reviews
          const totalPages = validatedData.pagination?.totalPages || 1;
          setHasMore(pageNum < totalPages);
        }
        setError(null);
      } catch (err) {
        log.error('Error fetching reviews:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reviews');
      } finally {
        setIsLoading(false);
      }
    },
    [productId, apiUrl, limit]
  );

  useEffect(() => {
    setPage(1);
    fetchReviews(1);
  }, [fetchReviews]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    await fetchReviews(nextPage, true);
  }, [hasMore, isLoading, page, fetchReviews]);

  const refetch = useCallback(async () => {
    setPage(1);
    await fetchReviews(1);
  }, [fetchReviews]);

  return {
    reviews,
    stats,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
  };
}

/**
 * Mark a review as helpful
 */
export async function markReviewHelpful(
  reviewId: string,
  voterIdentifier: string
): Promise<{ success: boolean; helpfulCount: number }> {
  const apiUrl = Constants.expoConfig?.extra?.apiUrl;

  if (!apiUrl) {
    throw new Error('API URL not configured');
  }

  const response = await fetch(`${apiUrl}/api/reviews/${reviewId}/helpful`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voterIdentifier }),
  });

  if (!response.ok) {
    throw new Error('Failed to mark review as helpful');
  }

  const rawData = await response.json();

  // 2026 Best Practice: Validate response
  const validated = parseApiResponse(
    MarkReviewHelpfulResponseSchema,
    rawData,
    'markReviewHelpful'
  );

  if (!validated) {
    // Graceful fallback
    return {
      success: rawData?.success ?? true,
      helpfulCount: rawData?.helpfulCount ?? 0,
    };
  }

  return validated;
}
