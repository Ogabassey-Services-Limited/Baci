import { describe, expect, it } from 'vitest';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';

describe('getStorefrontProductHref', () => {
  it('omits the base path when it is root', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'iPhone 15 Pro Max',
          slug: 'iphone-15-pro-max',
          categories: { slug: 'smartphones' },
        },
        '/'
      )
    ).toBe('/smartphones/iphone-15-pro-max');
  });

  it('builds a category canonical href when slug data is available', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'iPhone 15 Pro Max',
          slug: 'iphone-15-pro-max',
          categories: { slug: 'smartphones' },
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/smartphones/iphone-15-pro-max');
  });

  it('falls back to the products route when category data is unavailable', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'Test Product',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/products/test-product');
  });

  it('trims trailing slashes from the base path', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'Test Product',
        },
        '/ogabassey/'
      )
    ).toBe('/ogabassey/products/test-product');
  });
});
