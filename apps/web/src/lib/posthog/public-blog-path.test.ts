import { describe, expect, it } from 'vitest';
import { isPublicBlogPathname } from './public-blog-path';

describe('isPublicBlogPathname', () => {
  it.each([
    '/blog',
    '/blog/',
    '/blog/post-1',
    '/ogabassey/blog/post-1',
  ])('matches public blog route %s', (pathname) => {
    expect(isPublicBlogPathname(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/api/blog/feed/ogabassey',
    '/dashboard/blog',
    '/admin/blog',
    '/checkout',
    '/ogabassey/products',
  ])('does not match non-public blog route %s', (pathname) => {
    expect(isPublicBlogPathname(pathname)).toBe(false);
  });
});
