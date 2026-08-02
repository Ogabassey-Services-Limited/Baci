import { describe, expect, it } from 'vitest';
import { buildCategorySeoDecision } from './build-category-seo-decision';

describe('buildCategorySeoDecision', () => {
  it('orders and deduplicates hard category blockers', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: false,
        isActive: false,
        hasProducts: false,
        canonicalUrl: null,
      })
    ).toEqual({
      pageKind: 'category',
      index: false,
      follow: true,
      blockers: [
        'store_unpublished',
        'inactive_category',
        'empty_category',
        'missing_category_canonical_url',
      ],
    });
  });

  it('fails closed when publication or category activity is not explicitly true', () => {
    expect(
      buildCategorySeoDecision({
        isStorePublished: null,
        isActive: null,
        hasProducts: true,
        canonicalUrl: 'https://zorvexa.usebaci.com/fashion',
      })
    ).toMatchObject({
      index: false,
      blockers: ['store_unpublished', 'inactive_category'],
    });
  });
});
