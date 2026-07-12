import { describe, expect, it } from 'vitest';
import { buildProductReviewEnhancementSchema } from './product-review-enhancement-schema';

const productName = 'Anchor Flagship';
const productUrl = 'https://ogabassey.com/products/anchor-flagship';

describe('buildProductReviewEnhancementSchema', () => {
  it('returns null when there are no approved reviews to enrich', () => {
    expect(
      buildProductReviewEnhancementSchema({
        productName,
        productUrl,
        reviewStats: { averageRating: 0, totalReviews: 0 },
        recentReviews: [],
      })
    ).toBeNull();

    expect(
      buildProductReviewEnhancementSchema({
        productName,
        productUrl,
        reviewStats: null,
        recentReviews: null,
      })
    ).toBeNull();
  });

  it('emits a url-matched Product block with aggregateRating and reviews sorted by rating desc', () => {
    const schema = buildProductReviewEnhancementSchema({
      productName,
      productUrl,
      reviewStats: { averageRating: 4.34, totalReviews: 3 },
      recentReviews: [
        {
          rating: 3,
          reviewer_name: 'Ada',
          review_text: 'Good value',
          created_at: '2026-05-01T10:00:00.000Z',
        },
        {
          rating: 5,
          reviewer_name: null,
          review_text: null,
          created_at: '2026-05-02T10:00:00.000Z',
        },
      ],
    });

    expect(schema).not.toBeNull();
    // url + identity match the base schema so Google consolidates the blocks
    // instead of treating them as two products.
    expect(schema?.url).toBe(productUrl);
    expect(schema?.name).toBe(productName);
    expect(schema?.['@type']).toBe('Product');
    expect(schema?.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.3,
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1,
    });
    // Highest rating first, missing author/body fall back to safe defaults.
    expect(
      schema?.review?.map((entry) => entry.reviewRating.ratingValue)
    ).toEqual([5, 3]);
    expect(schema?.review?.[0]?.author.name).toBe('Anonymous');
    expect(schema?.review?.[0]?.reviewBody).toBe('');
    expect(schema?.review?.[1]?.author.name).toBe('Ada');
  });

  it('emits aggregateRating without a review array when only stats are present', () => {
    const schema = buildProductReviewEnhancementSchema({
      productName,
      productUrl,
      reviewStats: { averageRating: 4.8, totalReviews: 12 },
      recentReviews: [],
    });

    expect(schema?.aggregateRating?.reviewCount).toBe(12);
    expect(schema?.review).toBeUndefined();
  });

  it('emits reviews without aggregateRating when stats report zero total', () => {
    const schema = buildProductReviewEnhancementSchema({
      productName,
      productUrl,
      reviewStats: { averageRating: 0, totalReviews: 0 },
      recentReviews: [
        {
          rating: 4,
          reviewer_name: 'Ola',
          review_text: 'Solid',
          created_at: '2026-05-03T10:00:00.000Z',
        },
      ],
    });

    expect(schema?.aggregateRating).toBeUndefined();
    expect(schema?.review).toHaveLength(1);
  });
});
