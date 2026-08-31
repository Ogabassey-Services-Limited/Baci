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
});
