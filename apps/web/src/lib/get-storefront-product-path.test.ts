import { describe, expect, it } from 'vitest';
import { getStorefrontProductPath } from './get-storefront-product-path';

describe('getStorefrontProductPath', () => {
  it('uses a valid stored canonical path after one-time serialization', () => {
    expect(
      getStorefrontProductPath({
        id: 'watch-1',
        name: 'Watch',
        canonical_url: '/smart watches/watch?gps',
      })
    ).toBe('/smart%20watches/watch');
  });

  it('falls back to the stored category slug when no canonical is available', () => {
    expect(
      getStorefrontProductPath({
        id: 'watch-1',
        name: 'Watch',
        slug: 'watch',
        category_slug: 'smartwatches',
      })
    ).toBe('/smartwatches/watch');
  });

  it.each([
    ['raw whitespace', '   '],
    ['encoded whitespace', '%20%20'],
  ])('falls back before emitting a path segment for %s slugs', (_label, whitespaceSlug) => {
    expect(
      getStorefrontProductPath({
        id: 'watch-1',
        name: 'Watch',
        slug: whitespaceSlug,
        category_slug: whitespaceSlug,
        categories: { slug: whitespaceSlug },
      })
    ).toBe('/products/watch');
  });
});
