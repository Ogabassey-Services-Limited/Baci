import {
  type AggregateRatingSchema,
  generateAggregateRating,
} from '@/lib/seo-utils';

interface PdpReviewStats {
  averageRating: number;
  totalReviews: number;
}

interface PdpRecentReview {
  rating: number;
  reviewer_name: string | null;
  review_text: string | null;
  created_at: string;
}

interface ProductReviewSchema {
  '@type': 'Review';
  author: { '@type': 'Person'; name: string };
  datePublished: string;
  reviewBody: string;
  reviewRating: {
    '@type': 'Rating';
    ratingValue: number;
    bestRating: string;
    worstRating: string;
  };
}

export interface ProductReviewEnhancementSchema {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  url: string;
  aggregateRating?: AggregateRatingSchema;
  review?: ProductReviewSchema[];
}

/**
 * Builds a lean, url-matched Product structured-data block carrying ONLY the
 * live review signals (aggregateRating + review list).
 *
 * It streams BELOW the critical PDP shell so the price/availability (offers)
 * JSON-LD, the core product and the LCP image never await the reviews query.
 * Google consolidates multiple same-url Product blocks, so this preserves the
 * exact review rich-result data the previously-blocking build inlined without
 * duplicating the offers/identity of the base schema. Returns null when there
 * is nothing to enrich (no approved reviews), so no empty block is emitted.
 */
export function buildProductReviewEnhancementSchema(input: {
  productName: string;
  productUrl: string;
  reviewStats: PdpReviewStats | null;
  recentReviews: PdpRecentReview[] | null;
}): ProductReviewEnhancementSchema | null {
  const aggregateRating =
    input.reviewStats && input.reviewStats.totalReviews > 0
      ? generateAggregateRating({
          averageRating: input.reviewStats.averageRating,
          reviewCount: input.reviewStats.totalReviews,
        })
      : null;

  const review =
    input.recentReviews && input.recentReviews.length > 0
      ? [...input.recentReviews]
          .sort((left, right) => right.rating - left.rating)
          .map(
            (entry): ProductReviewSchema => ({
              '@type': 'Review',
              author: {
                '@type': 'Person',
                name: entry.reviewer_name || 'Anonymous',
              },
              datePublished: entry.created_at,
              reviewBody: entry.review_text || '',
              reviewRating: {
                '@type': 'Rating',
                ratingValue: entry.rating,
                bestRating: '5',
                worstRating: '1',
              },
            })
          )
      : null;

  if (!aggregateRating && (!review || review.length === 0)) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.productName,
    url: input.productUrl,
    ...(aggregateRating ? { aggregateRating } : {}),
    ...(review ? { review } : {}),
  };
}
