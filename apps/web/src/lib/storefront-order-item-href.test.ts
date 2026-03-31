import { describe, expect, it } from 'vitest';
import { getStorefrontOrderItemHref } from './storefront-order-item-href';

describe('getStorefrontOrderItemHref', () => {
  it('returns a category canonical href when exact route data is present', () => {
    expect(
      getStorefrontOrderItemHref(
        {
          product_slug: 'iphone-15-pro-max',
          category_slug: 'smartphones',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/smartphones/iphone-15-pro-max');
  });

  it('falls back to /products when only the exact product slug is available', () => {
    expect(
      getStorefrontOrderItemHref(
        {
          product_slug: 'iphone-15-pro-max',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/products/iphone-15-pro-max');
  });

  it('returns null when exact product route data is unavailable', () => {
    expect(
      getStorefrontOrderItemHref(
        {
          category_slug: 'smartphones',
        },
        '/ogabassey'
      )
    ).toBeNull();
  });
});
