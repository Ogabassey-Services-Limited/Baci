import { describe, expect, it } from 'vitest';
import {
  expectedRouteTextForRoute,
  extractMetaContent,
  hasDescription,
  isCanonicalForRoute,
  normalizeResponseHeaders,
  routePath,
} from './verify-ogabassey-blog-seo-html';

const HTML = `<!doctype html>
<html>
  <head>
    <title>Blog | Ogabassey</title>
    <meta content="Read expert buying guides, product comparisons, and tech updates from Ogabassey." name="description">
    <link href="https://ogabassey.com/blog" rel="canonical">
  </head>
</html>`;

describe('verify-ogabassey-blog-seo-html', () => {
  it('prefixes paths for local path-mode storefront verification', () => {
    expect(routePath('/blog', '/ogabassey.com')).toBe('/ogabassey.com/blog');
    expect(routePath('/blog', '/ogabassey.com/')).toBe('/ogabassey.com/blog');
    expect(routePath('/blog')).toBe('/blog');
  });

  it('reads description meta content regardless of attribute order', () => {
    expect(extractMetaContent(HTML, 'description')).toContain('Ogabassey');
    expect(hasDescription(HTML)).toBe(true);
    expect(hasDescription('<meta name="description" content="short">')).toBe(
      false
    );
  });

  it('derives route-specific text expectations for author and category pages', () => {
    expect(expectedRouteTextForRoute('/blog/category/smartphones')).toEqual({
      description: ['Smartphones'],
      title: ['Smartphones'],
    });
    expect(expectedRouteTextForRoute('/blog/author/bassey-john')).toEqual({
      description: ['Bassey John'],
      title: ['Bassey John'],
    });
    expect(expectedRouteTextForRoute('/blog')).toEqual({
      description: ['Ogabassey'],
      title: ['Blog'],
    });
  });

  it('validates canonical href against the clean route path and host', () => {
    expect(isCanonicalForRoute('https://ogabassey.com/blog', '/blog')).toBe(
      true
    );
    expect(
      isCanonicalForRoute('https://ogabassey.com/blog?page=2', '/blog')
    ).toBe(false);
    expect(
      isCanonicalForRoute('https://ogabassey.com/blog', '/blog/author/x')
    ).toBe(false);
    expect(isCanonicalForRoute('', '/blog')).toBe(false);
    // Host-aware: wrong host fails, right host passes.
    expect(
      isCanonicalForRoute(
        'https://evil.example.com/blog',
        '/blog',
        'ogabassey.com'
      )
    ).toBe(false);
    expect(
      isCanonicalForRoute('https://ogabassey.com/blog', '/blog', 'ogabassey.com')
    ).toBe(true);
  });

  it('normalizes Node response headers into a Headers instance', () => {
    const headers = normalizeResponseHeaders({
      vary: 'user-agent',
      'set-cookie': ['a=1', 'b=2'],
      'x-empty': undefined,
    });
    expect(headers.get('vary')).toBe('user-agent');
    expect(headers.get('set-cookie')).toContain('a=1');
  });
});
