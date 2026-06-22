import { describe, expect, it } from 'vitest';
import { isPublicBlogPathname } from './public-blog-path';

describe('isPublicBlogPathname', () => {
  it.each([
    '/blog',
    '/blog/',
    '/blog/post-1',
  ])('matches custom-domain public blog route %s', (pathname) => {
    expect(isPublicBlogPathname(pathname, { hostname: 'ogabassey.com' })).toBe(
      true
    );
  });

  it.each([
    '/ogabassey/blog',
    '/ogabassey/blog/post-1',
  ])('matches platform path-mode public blog route %s', (pathname) => {
    expect(isPublicBlogPathname(pathname, { hostname: 'usebaci.com' })).toBe(
      true
    );
  });

  it.each([
    '/',
    '/api/blog/feed/ogabassey',
    '/dashboard/blog',
    '/admin/blog',
    '/checkout',
    '/ogabassey/products',
  ])('does not match non-public blog route %s', (pathname) => {
    expect(isPublicBlogPathname(pathname, { hostname: 'usebaci.com' })).toBe(
      false
    );
  });

  it.each([
    '/products/blog',
    '/phones/blog',
    '/ogabassey/blog',
  ])('does not treat second-segment blog as public blog on custom domains: %s', (pathname) => {
    expect(isPublicBlogPathname(pathname, { hostname: 'ogabassey.com' })).toBe(
      false
    );
  });

  it('does not treat merchant subdomain second-segment blog as path-mode blog', () => {
    expect(
      isPublicBlogPathname('/phones/blog', { hostname: 'shop.usebaci.com' })
    ).toBe(false);
  });

  it('honors the configured platform root domain for path-mode blogs', () => {
    expect(
      isPublicBlogPathname('/ogabassey/blog/post-1', {
        hostname: 'preview.baci.test',
        rootDomain: 'preview.baci.test',
      })
    ).toBe(true);
  });

  it('treats Vercel preview hosts as platform path-mode hosts', () => {
    expect(
      isPublicBlogPathname('/ogabassey/blog/post-1', {
        hostname: 'baci-git-feature-ogabasseyy.vercel.app',
      })
    ).toBe(true);
  });
});
