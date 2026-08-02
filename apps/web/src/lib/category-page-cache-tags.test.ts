import { describe, expect, it } from 'vitest';
import { getCategoryPageDataCacheTag } from './category-page-cache-tags';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

describe('getCategoryPageDataCacheTag', () => {
  it('scopes category page data to the merchant', () => {
    expect(getCategoryPageDataCacheTag(MERCHANT_ID)).toBe(
      `category-page-data-${MERCHANT_ID}`
    );
  });
});
