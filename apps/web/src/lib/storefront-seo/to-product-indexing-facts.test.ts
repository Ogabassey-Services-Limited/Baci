import { describe, expect, it } from 'vitest';
import { toProductIndexingFacts } from './to-product-indexing-facts';

describe('toProductIndexingFacts', () => {
  it('normalizes only the resolved product facts needed by the hard decision', () => {
    expect(
      toProductIndexingFacts({
        isStorePublished: true,
        status: 'active',
        name: '  Linen Shirt  ',
        canonicalUrl: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
      })
    ).toEqual({
      isStorePublished: true,
      isActive: true,
      name: 'Linen Shirt',
      canonicalUrl: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
    });
  });

  it('does not infer active status when the resolved product status is absent', () => {
    expect(
      toProductIndexingFacts({
        isStorePublished: true,
        status: undefined,
        name: 'Linen Shirt',
        canonicalUrl: 'https://zorvexa.usebaci.com/fashion/linen-shirt',
      }).isActive
    ).toBe(false);
  });
});
