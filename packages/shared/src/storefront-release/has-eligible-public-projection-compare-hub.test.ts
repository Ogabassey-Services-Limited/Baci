import { describe, expect, it } from 'vitest';
import { hasEligiblePublicProjectionCompareHub } from './has-eligible-public-projection-compare-hub';

const category = { id: 'category-1' };

describe('hasEligiblePublicProjectionCompareHub', () => {
  it('orders products by origin keys before applying the bounded window', () => {
    const newestProducts = Array.from({ length: 80 }, (_, index) => ({
      categoryIds: [category.id],
      createdAt: `2026-08-${String(31 - Math.floor(index / 24)).padStart(2, '0')}T${String(23 - (index % 24)).padStart(2, '0')}:00:00Z`,
      id: `newest-${String(index).padStart(2, '0')}`,
      productKeySpecs: { camera: 12, screen: 6, storage: 128 },
    }));
    const olderPair = [
      {
        categoryIds: [category.id],
        createdAt: '2026-08-01T00:00:00Z',
        id: 'older-a',
        productKeySpecs: { camera: 12, screen: 6, storage: 128 },
      },
      {
        categoryIds: [category.id],
        createdAt: '2026-08-01T00:00:00Z',
        id: 'older-b',
        productKeySpecs: { camera: 48, screen: 6.7, storage: 256 },
      },
    ];

    expect(
      hasEligiblePublicProjectionCompareHub(
        [category],
        [...olderPair, ...newestProducts]
      )
    ).toBe(false);
  });

  it('finds a differentiating pair inside the origin window', () => {
    expect(
      hasEligiblePublicProjectionCompareHub(
        [category],
        [
          {
            categoryIds: [category.id],
            id: 'product-a',
            productKeySpecs: { camera: 12, screen: 6, storage: 128 },
          },
          {
            categoryIds: [category.id],
            id: 'product-b',
            productKeySpecs: { camera: 48, screen: 6.7, storage: 256 },
          },
        ]
      )
    ).toBe(true);
  });
});
