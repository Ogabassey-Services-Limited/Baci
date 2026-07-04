import { describe, expect, it } from 'vitest';
import { buildStorefrontBlogPurgeUrls } from './storefront-purge-urls';

describe('buildStorefrontBlogPurgeUrls', () => {
  it('builds /blog and per-post URLs for every custom hostname of a matched slug', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey'], ['post-a']);

    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/post-a',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
    ]);
  });

  it('resolves the policy when the identifier is a custom hostname', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey.com'], []);

    expect(urls).toContain('https://ogabassey.com/blog');
    expect(urls).toContain('https://www.ogabassey.com/blog');
  });

  it('returns an empty list for storefronts without a public cache policy', () => {
    expect(buildStorefrontBlogPurgeUrls(['unknown-store'], ['post-a'])).toEqual(
      []
    );
  });

  it('returns an empty list when there are no identifiers', () => {
    expect(buildStorefrontBlogPurgeUrls([], ['post-a'])).toEqual([]);
  });

  it('preserves the original slug casing in the purge URL (CDN paths are case-sensitive)', () => {
    const urls = buildStorefrontBlogPurgeUrls(
      ['ogabassey'],
      ['Best-Phones-2026']
    );

    // The slug must NOT be lowercased — purging /blog/best-phones-2026 would miss
    // the actually-cached mixed-case /blog/Best-Phones-2026 entry.
    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/Best-Phones-2026',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/Best-Phones-2026',
    ]);
  });

  it('deduplicates URLs and skips blank slugs', () => {
    const urls = buildStorefrontBlogPurgeUrls(
      ['ogabassey', 'ogabassey.com'],
      ['post-a', '  ', 'post-a']
    );

    // ogabassey (slug) and ogabassey.com (hostname) resolve to the same policy,
    // so the hostname set is emitted once; the blank slug is dropped.
    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/post-a',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
    ]);
  });

  it('emits /blog/category/<slug> for each affected category on every hostname', () => {
    const urls = buildStorefrontBlogPurgeUrls(
      ['ogabassey'],
      ['post-a'],
      ['buying-guides', 'reviews']
    );

    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/post-a',
      'https://ogabassey.com/blog/category/buying-guides',
      'https://ogabassey.com/blog/category/reviews',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
      'https://www.ogabassey.com/blog/category/buying-guides',
      'https://www.ogabassey.com/blog/category/reviews',
    ]);
  });

  it('emits category listing URLs even when there are no post slugs', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey'], [], ['reviews']);

    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/category/reviews',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/category/reviews',
    ]);
  });

  it('dedupes category slugs and preserves the original path casing', () => {
    const urls = buildStorefrontBlogPurgeUrls(
      ['ogabassey'],
      [],
      ['Reviews', '  ', 'Reviews']
    );

    // The CDN path is case-sensitive, so the slug casing is preserved and only
    // normalized duplicates / blanks are dropped.
    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/category/Reviews',
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/category/Reviews',
    ]);
  });
});
