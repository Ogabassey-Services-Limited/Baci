/**
 * Reviews Hook
 * Fetches product reviews from the API
 *
 * 2026 Best Practice: Zod validation for API responses
 */

import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
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

type ReviewsPage = {
  hasMore: boolean;
  reviews: Review[];
  stats: ReviewStats | null;
};

/**
 * Fetches and validates one page of reviews. Module-scope (outside the hook
 * render) so its try/throw control flow does not block React Compiler
 * memoization of `useReviews`.
 */
async function fetchReviewsPage(
  apiUrl: string,
  productId: string,
  pageNum: number,
  limit: number
): Promise<ReviewsPage> {
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
    const rawReviews: Review[] = Array.isArray(rawData?.reviews)
      ? rawData.reviews
          .filter(
            (r: unknown): r is Record<string, unknown> =>
              r != null && typeof r === 'object'
          )
          .map(
            (r: Record<string, unknown>): Review => ({
              id:
                typeof r.id === 'string'
                  ? r.id
                  : `fallback-${Date.now()}-${Crypto.randomUUID()}`,
              rating:
                typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5
                  ? r.rating
                  : 1,
              title: typeof r.title === 'string' ? r.title : undefined,
              body:
                typeof r.body === 'string'
                  ? r.body
                  : typeof r.comment === 'string'
                    ? (r.comment as string)
                    : '',
              customer_name:
                typeof r.customer_name === 'string'
                  ? r.customer_name
                  : 'Anonymous',
              verified_purchase:
                typeof r.verified_purchase === 'boolean'
                  ? r.verified_purchase
                  : false,
              helpful_count:
                typeof r.helpful_count === 'number' ? r.helpful_count : 0,
              created_at:
                typeof r.created_at === 'string'
                  ? r.created_at
                  : new Date().toISOString(),
            })
          )
      : [];
    const rawStats =
      rawData?.stats &&
      typeof rawData.stats === 'object' &&
      typeof rawData.stats.average_rating === 'number'
        ? rawData.stats
        : null;
    const totalPages = rawData?.pagination?.totalPages || 1;
    return {
      hasMore: pageNum < totalPages,
      reviews: rawReviews,
      stats: rawStats,
    };
  }

  // Use validated data
  const validatedReviews: Review[] = (validatedData.reviews ?? []).map(
    (review) => ({
      ...review,
      helpful_count: review.helpful_count ?? 0,
    })
  );

  // Check if there are more reviews
  const totalPages = validatedData.pagination?.totalPages || 1;
  return {
    hasMore: pageNum < totalPages,
    reviews: validatedReviews,
    stats: validatedData.stats ?? null,
  };
}

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
  // L7 fix: Use isLoadingMore state to prevent concurrent loadMore calls
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const apiUrl = Constants.expoConfig?.extra?.apiUrl;

  // Reset pagination inline during render when the query identity changes
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const fetchKey = `${productId}|${apiUrl}|${limit}`;
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey);
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey);
    setPage(1);
  }

  const fetchReviews = async (pageNum: number, append = false) => {
    if (!productId || !apiUrl) {
      setIsLoading(false);
      return;
    }

    if (!append) {
      setIsLoading(true);
    }

    try {
      const result = await fetchReviewsPage(apiUrl, productId, pageNum, limit);
      if (append) {
        setReviews((prev) => [...prev, ...result.reviews]);
      } else {
        setReviews(result.reviews);
      }
      if (result.stats) {
        setStats(result.stats);
      }
      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      log.error('Error fetching reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    }
    setIsLoading(false);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchReviews is intentionally not in deps to avoid infinite loop (plain function, not memoized)
  useEffect(() => {
    fetchReviews(1);
  }, [productId, apiUrl, limit]);

  const loadMore = async () => {
    if (!hasMore || isLoading || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchReviews(nextPage, true).finally(() => setIsLoadingMore(false));
  };

  const refetch = async () => {
    setPage(1);
    await fetchReviews(1);
  };

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
