import { describe, expect, it } from 'vitest';
import { buildBlogListingRouteHref } from './blog-listing-route';

describe('buildBlogListingRouteHref', () => {
  it('keeps the first blog page param-free', () => {
    expect(
      buildBlogListingRouteHref({ storeBasePath: '/ogabassey', page: 1 })
    ).toBe('/ogabassey/blog');
  });

  it('preserves filters and pagination in a stable query string', () => {
    expect(
      buildBlogListingRouteHref({
        storeBasePath: '',
        category: 'Buying Guides',
        page: 3,
        search: 'iphone 17',
      })
    ).toBe('/blog?category=Buying+Guides&search=iphone+17&page=3');
  });
});
