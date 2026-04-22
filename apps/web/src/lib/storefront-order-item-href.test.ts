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

  it('prefers categories.slug over category_slug when both are present', () => {
    expect(
      getStorefrontOrderItemHref(
        {
          product_slug: 'iphone-15-pro-max',
          categories: { slug: 'preferred-category' },
          category_slug: 'fallback-category',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/preferred-category/iphone-15-pro-max');
  });

  it('normalizes category aliases when building canonical hrefs', () => {
    expect(
      getStorefrontOrderItemHref(
        {
          product_slug: 'macbook-air-13-inch-2022-m2-8gb-256gb',
          category_slug: 'macbook',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/laptops/macbook-air-13-inch-2022-m2-8gb-256gb');
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
