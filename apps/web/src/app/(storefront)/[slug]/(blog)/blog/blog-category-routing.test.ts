import { describe, expect, it } from 'vitest';
import {
  buildBlogCategoryHref,
  buildBlogCategorySchemaUrl,
  findBlogCategoryLabelBySlug,
  getBlogCategorySlug,
} from './blog-category-routing';

describe('blog category routing', () => {
  it('generates clean lowercase category slugs', () => {
    expect(getBlogCategorySlug('Smartphones')).toBe('smartphones');
    expect(getBlogCategorySlug('Cases & Covers')).toBe('cases-covers');
  });

  it('builds storefront-relative category hub hrefs', () => {
    expect(buildBlogCategoryHref('/', 'Smartphones')).toBe(
      '/blog/category/smartphones'
    );
    expect(buildBlogCategoryHref('', 'Smartphones')).toBe(
      '/blog/category/smartphones'
    );
    expect(buildBlogCategoryHref('/ogabassey', 'Smartphones')).toBe(
      '/ogabassey/blog/category/smartphones'
    );
    expect(buildBlogCategoryHref('/ogabassey/', 'Smartphones')).toBe(
      '/ogabassey/blog/category/smartphones'
    );
  });

  it('builds absolute schema URLs without leaking query filters', () => {
    expect(
      buildBlogCategorySchemaUrl('https://ogabassey.com', 'Smartphones')
    ).toBe('https://ogabassey.com/blog/category/smartphones');
    expect(
      buildBlogCategorySchemaUrl('https://ogabassey.com/', 'Smartphones')
    ).toBe('https://ogabassey.com/blog/category/smartphones');
  });

  it('throws when category schema URLs receive an invalid base URL', () => {
    expect(() =>
      buildBlogCategorySchemaUrl('not-a-valid-url', 'Smartphones')
    ).toThrow();
  });

  it('matches category labels by slug', () => {
    expect(
      findBlogCategoryLabelBySlug(
        ['Smartphones', 'Cases & Covers'],
        'cases-covers'
      )
    ).toBe('Cases & Covers');
  });

  it('returns null for unknown slugs', () => {
    expect(findBlogCategoryLabelBySlug(['Smartphones'], 'phones')).toBeNull();
  });
});
