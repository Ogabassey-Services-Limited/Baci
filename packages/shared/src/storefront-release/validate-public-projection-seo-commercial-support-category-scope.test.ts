import { describe, expect, it } from 'vitest';
import { hasEligibleCommercialSupportPath } from './validate-public-projection-seo-commercial-support';

const parent = { id: 'category-parent', slug: 'smartphones' };
const products = Array.from({ length: 6 }, (_, index) => ({
  available: true,
  brand: ['Samsung', 'Apple', 'Google'][index % 3],
  categoryIds: ['category-child'],
  name: `Phone ${index}`,
  priceMinor: 400_000 + index,
  slug: `phone-${index}`,
}));

describe('price-band category scope', () => {
  it('includes active direct-child inventory in a parent price band', () => {
    const child = {
      id: 'category-child',
      parentId: parent.id,
      slug: 'android-phones',
      status: 'active',
    };

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        new Map([
          [parent.slug, parent],
          [child.slug, child],
        ]),
        products
      )
    ).toBe(true);
  });

  it('does not include inactive direct-child inventory in a parent price band', () => {
    const child = {
      id: 'category-child',
      parentId: parent.id,
      slug: 'android-phones',
      status: 'inactive',
    };

    expect(
      hasEligibleCommercialSupportPath(
        '/smartphones/best-under/under-500k',
        new Map([
          [parent.slug, parent],
          [child.slug, child],
        ]),
        products
      )
    ).toBe(false);
  });
});
