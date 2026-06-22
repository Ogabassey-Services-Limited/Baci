import { describe, expect, it } from 'vitest';
import { isPublicBlogPathname } from './public-blog-path';

describe('isPublicBlogPathname', () => {
  it('matches blog as the first path segment (custom-domain storefronts)', () => {
    expect(isPublicBlogPathname('/blog')).toBe(true);
    expect(isPublicBlogPathname('/blog/best-phones-under-200k')).toBe(true);
  });

  it('matches blog as the second path segment (slug-routed storefronts)', () => {
    expect(isPublicBlogPathname('/ogabassey/blog')).toBe(true);
    expect(isPublicBlogPathname('/ogabassey/blog/best-phones')).toBe(true);
  });

  it('ignores query strings and hashes when matching', () => {
    expect(isPublicBlogPathname('/blog/post?utm_source=google')).toBe(true);
    expect(isPublicBlogPathname('/ogabassey/blog#comments')).toBe(true);
  });

  it('does not match platform routes or non-blog storefront pages', () => {
    for (const pathname of [
      '/',
      '/dashboard',
      '/admin/blog',
      '/api/blog',
      '/ogabassey',
      '/ogabassey/products/iphone',
      '/login',
    ]) {
      expect(isPublicBlogPathname(pathname)).toBe(false);
    }
  });

  it('treats nullish or empty pathnames as non-blog', () => {
    expect(isPublicBlogPathname(null)).toBe(false);
    expect(isPublicBlogPathname(undefined)).toBe(false);
    expect(isPublicBlogPathname('')).toBe(false);
  });
});
