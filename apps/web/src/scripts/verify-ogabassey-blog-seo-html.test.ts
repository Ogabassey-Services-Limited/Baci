import { describe, expect, it } from 'vitest';
import {
  containsAllText,
  expectedRouteTextForRoute,
  extractCanonicalHref,
  extractMetaContent,
  extractTitle,
  hasBlogLinks,
  hasDescription,
  hasJsonLd,
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
    <script type="application/ld+json">{"@context":"https://schema.org"}</script>
  </head>
  <body><a href="/blog/best-phones">Best phones</a></body>
</html>`;

describe('verify-ogabassey-blog-seo-html', () => {
  it('prefixes paths for local path-mode storefront verification', () => {
    expect(routePath('/blog', '/ogabassey.com')).toBe('/ogabassey.com/blog');
    expect(routePath('/blog', '/ogabassey.com/')).toBe('/ogabassey.com/blog');
    expect(routePath('/blog')).toBe('/blog');
    // A slashless prefix is normalized to a leading-slash path.
    expect(routePath('/blog', 'ogabassey.com')).toBe('/ogabassey.com/blog');
  });

  it('extracts the document title', () => {
    expect(extractTitle(HTML)).toBe('Blog | Ogabassey');
    expect(extractTitle('<html></html>')).toBe('');
  });

  it('extracts the canonical href', () => {
    expect(extractCanonicalHref(HTML)).toBe('https://ogabassey.com/blog');
    expect(extractCanonicalHref('<html></html>')).toBe('');
  });

  it('detects a JSON-LD script block', () => {
    expect(hasJsonLd(HTML)).toBe(true);
    expect(hasJsonLd('<html></html>')).toBe(false);
  });

  it('detects crawlable blog links, including relative author-page links', () => {
    // Absolute link.
    expect(hasBlogLinks(HTML)).toBe(true);
    // Relative `../<post>` on an author page resolves to /blog/<post>.
    const authorHtml = '<a href="../best-phones">Best phones</a>';
    expect(hasBlogLinks(authorHtml, '/blog/author/bassey-john')).toBe(true);
    // Path-prefix mode still resolves relative links under /blog/.
    expect(hasBlogLinks(authorHtml, '/ogabassey.com/blog/author/bassey-john')).toBe(
      true
    );
    // No blog links present.
    expect(hasBlogLinks('<a href="/about">About</a>', '/blog')).toBe(false);
  });

  it('checks that all needles are present (case-insensitive)', () => {
    expect(containsAllText('Smartphones Articles | Ogabassey', ['smartphones'])).toBe(
      true
    );
    expect(containsAllText('Blog | Ogabassey', ['smartphones'])).toBe(false);
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
