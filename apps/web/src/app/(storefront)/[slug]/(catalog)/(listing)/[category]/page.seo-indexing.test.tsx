import { describe, expect, it } from 'vitest';
import { buildCategorySeoDecision } from '@/lib/storefront-seo/build-category-seo-decision';

describe('category page SEO indexing', () => {
  it('keeps a category non-indexable when its product query fails', () => {
    const decision = buildCategorySeoDecision({
      isStorePublished: true,
      isActive: true,
      hasProducts: false,
      canonicalUrl: 'https://zorvexa.usebaci.com/fashion',
    });

    expect(decision.index).toBe(false);
    expect(decision.blockers).toContain('empty_category');
  });
});
