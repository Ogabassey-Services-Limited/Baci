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
});
