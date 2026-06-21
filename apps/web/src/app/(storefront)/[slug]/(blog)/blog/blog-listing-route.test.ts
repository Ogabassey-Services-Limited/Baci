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

  it('normalizes root and trailing-slash base paths before appending blog', () => {
    expect(buildBlogListingRouteHref({ storeBasePath: '/', page: 1 })).toBe(
      '/blog'
    );
    expect(
      buildBlogListingRouteHref({ storeBasePath: '/ogabassey/', page: 2 })
    ).toBe('/ogabassey/blog?page=2');
  });

  it('url-encodes filter and search values with special characters', () => {
    expect(
      buildBlogListingRouteHref({
        storeBasePath: '/ogabassey',
        category: 'Deals & Offers',
        page: 2,
        search: 'iphone 17 + pro',
      })
    ).toBe(
      '/ogabassey/blog?category=Deals+%26+Offers&search=iphone+17+%2B+pro&page=2'
    );
  });
});
