import { describe, expect, it } from 'vitest';
import { buildBlogListingSchemaUrl } from './blog-listing-schema-url';

describe('buildBlogListingSchemaUrl', () => {
  it('appends blog routes to path-prefixed storefront base URLs', () => {
    expect(
      buildBlogListingSchemaUrl({
        baseUrl: 'http://localhost:3000/ogabassey',
        page: 2,
      })
    ).toBe('http://localhost:3000/ogabassey/blog?page=2');
  });

  it('omits the page query on the first page and preserves filters', () => {
    expect(
      buildBlogListingSchemaUrl({
        baseUrl: 'https://ogabassey.com',
        category: 'News',
        page: 1,
        search: 'iphone',
      })
    ).toBe('https://ogabassey.com/blog?category=News&search=iphone');
  });
});
