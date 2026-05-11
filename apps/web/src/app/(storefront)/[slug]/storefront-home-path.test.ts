import { describe, expect, it } from 'vitest';
import { isStorefrontHomePath } from './storefront-home-path';

describe('isStorefrontHomePath', () => {
  it('matches custom-domain root requests', () => {
    expect(
      isStorefrontHomePath({
        merchantSlug: 'ogabassey',
        pathname: '/',
        routeSlug: 'ogabassey.com',
      })
    ).toBe(true);
  });

  it('matches slug home paths with or without trailing slashes', () => {
    expect(
      isStorefrontHomePath({
        merchantSlug: 'ogabassey',
        pathname: '/ogabassey/',
        routeSlug: 'ogabassey',
      })
    ).toBe(true);
  });

  it('matches merchant slug when the route identifier is a domain', () => {
    expect(
      isStorefrontHomePath({
        merchantSlug: 'ogabassey',
        pathname: '/ogabassey',
        routeSlug: 'ogabassey.com',
      })
    ).toBe(true);
  });

  it('does not match nested storefront routes', () => {
    expect(
      isStorefrontHomePath({
        merchantSlug: 'ogabassey',
        pathname: '/ogabassey/products/iphone-17-pro-max',
        routeSlug: 'ogabassey',
      })
    ).toBe(false);
  });
});
