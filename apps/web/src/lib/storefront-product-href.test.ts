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

  it('preserves merchant-defined category slugs when building hrefs', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'Samsung Galaxy S25 Ultra',
          slug: 'samsung-galaxy-s25-ultra-12gb-512gb',
          categories: { slug: 'samsung' },
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/samsung/samsung-galaxy-s25-ultra-12gb-512gb');
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

  it('prefers canonical_url over legacy category path fields', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'Nintendo Switch OLED',
          slug: 'nintendo-switch-oled-8gb-512gb',
          categories: { slug: 'nintendo-switch' },
          canonical_url:
            'https://usebaci.com/ogabassey/gaming/nintendo-switch-oled',
        },
        '/ogabassey'
      )
    ).toBe('/ogabassey/gaming/nintendo-switch-oled');
  });

  it('preserves merchant-defined canonical category slugs', () => {
    expect(
      getStorefrontProductHref(
        {
          id: 'p1',
          name: 'Samsung Galaxy S25 Ultra',
          slug: 'samsung-galaxy-s25-ultra-12gb-1tb',
          canonical_url: '/samsung/samsung-galaxy-s25-ultra',
        },
        '/'
      )
    ).toBe('/samsung/samsung-galaxy-s25-ultra');
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
