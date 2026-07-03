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
});
