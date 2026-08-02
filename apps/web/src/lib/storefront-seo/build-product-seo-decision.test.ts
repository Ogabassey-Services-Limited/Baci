import { describe, expect, it } from 'vitest';
import { buildProductSeoDecision } from './build-product-seo-decision';
import { isSeoSitemapEligible } from './seo-indexing-metadata';

describe('buildProductSeoDecision', () => {
  it('keeps an active canonical product indexable despite enrichment gaps', () => {
    const decision = buildProductSeoDecision({
      isStorePublished: true,
      isActive: true,
      name: 'Linen Shirt',
      canonicalUrl: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
    });

    expect(decision).toEqual({
      pageKind: 'product',
      index: true,
      follow: true,
      blockers: [],
    });
    expect(isSeoSitemapEligible(decision)).toBe(true);
  });

  it('blocks a product without a valid canonical URL', () => {
    expect(
      buildProductSeoDecision({
        isStorePublished: true,
        isActive: true,
        name: 'Linen Shirt',
        canonicalUrl: null,
      })
    ).toMatchObject({
      index: false,
      follow: true,
      blockers: ['missing_product_canonical_url'],
    });
  });
});
