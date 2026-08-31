import { describe, expect, it } from 'vitest';
import { hasEligiblePublicProjectionComparePath } from './public-projection-seo-compare';

const category = { id: 'category-1', slug: 'smartphones' };
const categories = new Map([[category.slug, category]]);

function product(slug: string, brand: string, offset: number) {
  return {
    brand,
    categoryIds: [category.id],
    productKeySpecs: {
      camera: offset,
      display: offset,
      storage: offset,
    },
    slug,
  };
}

describe('public projection compare route eligibility', () => {
  it('requires a maintained manifest entry for product comparisons', () => {
    const path = '/smartphones/compare/phone-a-vs-phone-b';
    const products = [product('phone-a', 'A', 1), product('phone-b', 'B', 2)];

    expect(
      hasEligiblePublicProjectionComparePath(path, categories, products)
    ).toBe(false);
    expect(
      hasEligiblePublicProjectionComparePath(path, categories, products, {
        maintainedComparePaths: new Set([path]),
      })
    ).toBe(true);
  });

  it('accepts only the origin-selected brand pair', () => {
    const products = [
      ...Array.from({ length: 3 }, (_, index) =>
        product(`alpha-${index}`, 'Alpha', index)
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        product(`beta-${index}`, 'Beta', index)
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        product(`gamma-${index}`, 'Gamma', index)
      ),
    ];

    expect(
      hasEligiblePublicProjectionComparePath(
        '/smartphones/compare/alpha-vs-beta',
        categories,
        products
      )
    ).toBe(true);
    expect(
      hasEligiblePublicProjectionComparePath(
        '/smartphones/compare/beta-vs-gamma',
        categories,
        products
      )
    ).toBe(false);
  });

  it('ignores product comparisons outside the newest origin inventory window', () => {
    const newestProducts = Array.from({ length: 600 }, (_, index) => ({
      ...product(`newest-${index}`, '', index),
      createdAt: `2026-08-${String(31 - Math.floor(index / 24)).padStart(2, '0')}T${String(23 - (index % 24)).padStart(2, '0')}:00:00Z`,
      id: `newest-${String(index).padStart(3, '0')}`,
    }));
    const olderPair = [
      {
        ...product('phone-a', 'A', 1),
        createdAt: '2026-01-01T00:00:00Z',
        id: 'older-a',
      },
      {
        ...product('phone-b', 'B', 2),
        createdAt: '2026-01-01T00:00:00Z',
        id: 'older-b',
      },
    ];
    const path = '/smartphones/compare/phone-a-vs-phone-b';

    expect(
      hasEligiblePublicProjectionComparePath(
        path,
        categories,
        [...newestProducts, ...olderPair],
        { maintainedComparePaths: new Set([path]) }
      )
    ).toBe(false);
  });
});
