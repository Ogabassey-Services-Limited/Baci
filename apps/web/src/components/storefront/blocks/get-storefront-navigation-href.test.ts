import { describe, expect, it } from 'vitest';
import { getStorefrontNavigationHref } from './get-storefront-navigation-href';

describe('getStorefrontNavigationHref', () => {
  it('keeps uppercase HTTPS navigation URLs external', () => {
    expect(
      getStorefrontNavigationHref('HTTPS://example.test/shop', '/demo-store')
    ).toBe('HTTPS://example.test/shop');
  });

  it('prefixes root-relative storefront navigation URLs', () => {
    expect(getStorefrontNavigationHref('/shop', '/demo-store')).toBe(
      '/demo-store/shop'
    );
  });
});
