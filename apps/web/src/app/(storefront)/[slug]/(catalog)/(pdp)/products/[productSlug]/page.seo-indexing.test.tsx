import { describe, expect, it } from 'vitest';
import { buildProductSeoDecision } from '@/lib/storefront-seo/build-product-seo-decision';
import { toProductIndexingFacts } from '@/lib/storefront-seo/to-product-indexing-facts';

describe('product page SEO indexing', () => {
  it('fails closed for a product with no active status or name', () => {
    const decision = buildProductSeoDecision(
      toProductIndexingFacts({
        isStorePublished: true,
        status: undefined,
        name: ' ',
        canonicalUrl: 'https://zorvexa.usebaci.com/products/product-1',
      })
    );

    expect(decision.index).toBe(false);
    expect(decision.blockers).toEqual([
      'inactive_product',
      'missing_product_name',
    ]);
  });
});
