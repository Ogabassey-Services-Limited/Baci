import { describe, expect, it } from 'vitest';
import { fetchMorePostsInputSchema } from './storefront-blog-actions';

const VALID_MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';

describe('fetchMorePostsInputSchema', () => {
  it('accepts a valid uuid merchant id with page and optional filters', () => {
    const result = fetchMorePostsInputSchema.safeParse({
      merchantId: VALID_MERCHANT_ID,
      page: 2,
      category: 'Guides',
      searchQuery: 'shoes',
    });

    expect(result.success).toBe(true);
  });

  it('accepts input without optional category and searchQuery', () => {
    const result = fetchMorePostsInputSchema.safeParse({
      merchantId: VALID_MERCHANT_ID,
      page: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rejects non-uuid merchant ids', () => {
    const result = fetchMorePostsInputSchema.safeParse({
      merchantId: 'merchant-1',
      page: 1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects pages below 1, above 200, and non-integers', () => {
    for (const page of [0, -1, 201, 1.5]) {
      const result = fetchMorePostsInputSchema.safeParse({
        merchantId: VALID_MERCHANT_ID,
        page,
      });

      expect(result.success).toBe(false);
    }
  });

  it('rejects category and searchQuery longer than 100 characters', () => {
    const longValue = 'a'.repeat(101);

    expect(
      fetchMorePostsInputSchema.safeParse({
        merchantId: VALID_MERCHANT_ID,
        page: 1,
        category: longValue,
      }).success
    ).toBe(false);
    expect(
      fetchMorePostsInputSchema.safeParse({
        merchantId: VALID_MERCHANT_ID,
        page: 1,
        searchQuery: longValue,
      }).success
    ).toBe(false);
  });
});
