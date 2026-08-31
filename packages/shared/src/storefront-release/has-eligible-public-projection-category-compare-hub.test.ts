import { describe, expect, it } from 'vitest';
import { hasEligiblePublicProjectionCategoryCompareHub } from './has-eligible-public-projection-category-compare-hub';

const parent = { id: 'category-parent', slug: 'phones' };
const child = {
  id: 'category-child',
  parentId: parent.id,
  slug: 'android-phones',
};
const products = [
  {
    available: true,
    categoryIds: [child.id],
    name: 'Phone A',
    priceMinor: 100_000,
    productKeySpecs: { camera: 12, storage: 128, screen: 6 },
    slug: 'phone-a',
  },
  {
    available: true,
    categoryIds: [child.id],
    name: 'Phone B',
    priceMinor: 100_000,
    productKeySpecs: { camera: 48, storage: 256, screen: 6.7 },
    slug: 'phone-b',
  },
];

describe('hasEligiblePublicProjectionCategoryCompareHub', () => {
  it('accepts a parent hub backed by an eligible direct-child comparison', () => {
    const categories = new Map([
      [parent.slug, parent],
      [child.slug, child],
    ]);

    expect(
      hasEligiblePublicProjectionCategoryCompareHub(
        parent.slug,
        categories,
        products,
        new Set(['/android-phones/compare/phone-a-vs-phone-b']),
        'NGN'
      )
    ).toBe(true);
  });

  it('does not treat a grandchild-only comparison as parent inventory', () => {
    const grandchild = {
      id: 'category-grandchild',
      parentId: child.id,
      slug: 'foldables',
    };
    const categories = new Map([
      [parent.slug, parent],
      [child.slug, child],
      [grandchild.slug, grandchild],
    ]);

    expect(
      hasEligiblePublicProjectionCategoryCompareHub(
        parent.slug,
        categories,
        products,
        new Set(['/foldables/compare/phone-a-vs-phone-b']),
        'NGN'
      )
    ).toBe(false);
  });

  it('ignores inactive direct-child comparison inventory', () => {
    const inactiveChild = { ...child, status: 'inactive' };
    const categories = new Map([
      [parent.slug, parent],
      [inactiveChild.slug, inactiveChild],
    ]);

    expect(
      hasEligiblePublicProjectionCategoryCompareHub(
        parent.slug,
        categories,
        products,
        new Set(['/android-phones/compare/phone-a-vs-phone-b']),
        'NGN'
      )
    ).toBe(false);
  });

  it('does not use comparison products beyond the hub inventory limit', () => {
    const categories = new Map([[parent.slug, parent]]);
    const newestProducts = Array.from({ length: 300 }, (_, index) => ({
      available: true,
      categoryIds: [parent.id],
      createdAt: `2026-08-${String(31 - Math.floor(index / 24)).padStart(2, '0')}T${String(23 - (index % 24)).padStart(2, '0')}:00:00Z`,
      id: `newest-${String(index).padStart(3, '0')}`,
      name: `Newest ${index}`,
      priceMinor: 100_000,
      productKeySpecs: { camera: 1, storage: 1, screen: 1 },
      slug: `newest-${index}`,
    }));
    const overflowPair = products.map((product, index) => ({
      ...product,
      categoryIds: [parent.id],
      createdAt: '2026-01-01T00:00:00Z',
      id: `overflow-${index}`,
    }));

    expect(
      hasEligiblePublicProjectionCategoryCompareHub(
        parent.slug,
        categories,
        [...newestProducts, ...overflowPair],
        new Set(['/phones/compare/phone-a-vs-phone-b']),
        'NGN'
      )
    ).toBe(false);
  });
});
