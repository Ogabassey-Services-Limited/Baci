import { describe, expect, it } from 'vitest';
import { getBlogAuthorSlugs } from './blog-authors';
import {
  buildStorefrontBlogPurgeUrls,
  buildStorefrontProductPurgeUrls,
  resolveProductPurgeCategorySegment,
} from './storefront-purge-urls';

// Author hub pages are emitted for every registered author slug on every
// resolved hostname (see buildStorefrontBlogPurgeUrls). These are the two
// static, ogabassey-gated registry slugs, appended AFTER the /blog, per-post,
// and per-category URLs for each hostname.
const AUTHOR_SLUGS = getBlogAuthorSlugs();

function authorUrls(hostname: string): string[] {
  return AUTHOR_SLUGS.map((slug) => `https://${hostname}/blog/author/${slug}`);
}

describe('buildStorefrontBlogPurgeUrls', () => {
  it('builds /blog, per-post, and author-hub URLs for every custom hostname of a matched slug', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey'], ['post-a']);

    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/post-a',
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
      ...authorUrls('www.ogabassey.com'),
    ]);
  });

  it('resolves the policy when the identifier is a custom hostname', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey.com'], []);

    expect(urls).toContain('https://ogabassey.com/blog');
    expect(urls).toContain('https://www.ogabassey.com/blog');
  });

  it('emits an author-hub URL per registered author on every resolved hostname', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey'], []);

    // Author hubs list a byline's posts, so any post mutation can change them —
    // they are always evicted alongside /blog. Slugs come from the registry.
    expect(AUTHOR_SLUGS.length).toBeGreaterThan(0);
    for (const slug of AUTHOR_SLUGS) {
      expect(urls).toContain(`https://ogabassey.com/blog/author/${slug}`);
      expect(urls).toContain(`https://www.ogabassey.com/blog/author/${slug}`);
    }
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
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/Best-Phones-2026',
      ...authorUrls('www.ogabassey.com'),
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
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
      ...authorUrls('www.ogabassey.com'),
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
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/post-a',
      'https://www.ogabassey.com/blog/category/buying-guides',
      'https://www.ogabassey.com/blog/category/reviews',
      ...authorUrls('www.ogabassey.com'),
    ]);
  });

  it('emits category listing URLs even when there are no post slugs', () => {
    const urls = buildStorefrontBlogPurgeUrls(['ogabassey'], [], ['reviews']);

    expect(urls).toEqual([
      'https://ogabassey.com/blog',
      'https://ogabassey.com/blog/category/reviews',
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/category/reviews',
      ...authorUrls('www.ogabassey.com'),
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
      ...authorUrls('ogabassey.com'),
      'https://www.ogabassey.com/blog',
      'https://www.ogabassey.com/blog/category/Reviews',
      ...authorUrls('www.ogabassey.com'),
    ]);
  });
});

describe('resolveProductPurgeCategorySegment', () => {
  it('derives the category segment from a legacy text category', () => {
    expect(
      resolveProductPurgeCategorySegment({
        slug: 'iphone-15',
        name: 'iPhone 15',
        category: 'Smartphones',
      })
    ).toBe('smartphones');
  });

  it('prefers the joined category slug (direct category resolution)', () => {
    expect(
      resolveProductPurgeCategorySegment({
        slug: 'rog-ally',
        name: 'ROG Ally',
        category: 'Ignored Legacy Text',
        categories: { name: 'Gaming', slug: 'Gaming-Laptops' },
      })
    ).toBe('gaming-laptops');
  });

  it('uses category_slug when no joined category is present', () => {
    expect(
      resolveProductPurgeCategorySegment({
        slug: 'ipad-air',
        name: 'iPad Air',
        category_slug: 'Tablets',
      })
    ).toBe('tablets');
  });

  it('prefers the joined category slug over both category_slug and legacy text', () => {
    // Full PR #2914 precedence: direct category_id join wins over the
    // category_slug and the legacy text column, so the purge targets the same
    // canonical the storefront serves.
    expect(
      resolveProductPurgeCategorySegment({
        slug: 'rog-ally',
        name: 'ROG Ally',
        category: 'Legacy Text',
        category_slug: 'legacy-slug',
        categories: { name: 'Gaming', slug: 'gaming-laptops' },
      })
    ).toBe('gaming-laptops');
  });

  it('returns null when the product resolves to the /products/<slug> fallback', () => {
    expect(
      resolveProductPurgeCategorySegment({
        slug: 'mystery-box',
        name: 'Mystery Box',
        category: null,
      })
    ).toBeNull();
  });

  it('returns null for a missing/blank slug', () => {
    expect(
      resolveProductPurgeCategorySegment({ slug: '   ', category: 'Audio' })
    ).toBeNull();
  });
});

describe('buildStorefrontProductPurgeUrls', () => {
  it('emits canonical PDP, fallback PDP, category listing, and home per hostname', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey'],
      [{ slug: 'iphone-15', categorySegment: 'smartphones' }]
    );

    expect(urls).toEqual([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/smartphones/iphone-15',
      'https://ogabassey.com/products/iphone-15',
      'https://ogabassey.com/smartphones',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/smartphones/iphone-15',
      'https://www.ogabassey.com/products/iphone-15',
      'https://www.ogabassey.com/smartphones',
    ]);
  });

  it('emits the /products listing once per hostname for every product mutation', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey'],
      [{ slug: 'iphone-15', categorySegment: 'smartphones' }]
    );

    // The all-products listing is a cacheable public document, so it must be
    // evicted (exactly once per hostname) on any product change.
    expect(
      urls.filter((url) => url === 'https://ogabassey.com/products')
    ).toEqual(['https://ogabassey.com/products']);
    expect(urls).toContain('https://www.ogabassey.com/products');
  });

  it('emits only the fallback PDP, products listing, and home when the category is unknown', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey'],
      [{ slug: 'mystery-box', categorySegment: null }]
    );

    expect(urls).toEqual([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/products/mystery-box',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/products/mystery-box',
    ]);
  });

  it('emits one listing per distinct category across multiple products', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey.com'],
      [
        { slug: 'iphone-15', categorySegment: 'smartphones' },
        { slug: 'galaxy-s24', categorySegment: 'smartphones' },
        { slug: 'ipad-air', categorySegment: 'tablets' },
      ]
    );

    // The two smartphones collapse to a single /smartphones listing; each PDP
    // (canonical + fallback) is still emitted.
    expect(urls).toEqual([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/smartphones/iphone-15',
      'https://ogabassey.com/products/iphone-15',
      'https://ogabassey.com/smartphones/galaxy-s24',
      'https://ogabassey.com/products/galaxy-s24',
      'https://ogabassey.com/tablets/ipad-air',
      'https://ogabassey.com/products/ipad-air',
      'https://ogabassey.com/smartphones',
      'https://ogabassey.com/tablets',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/smartphones/iphone-15',
      'https://www.ogabassey.com/products/iphone-15',
      'https://www.ogabassey.com/smartphones/galaxy-s24',
      'https://www.ogabassey.com/products/galaxy-s24',
      'https://www.ogabassey.com/tablets/ipad-air',
      'https://www.ogabassey.com/products/ipad-air',
      'https://www.ogabassey.com/smartphones',
      'https://www.ogabassey.com/tablets',
    ]);
  });

  it('preserves original slug and category casing (CDN paths are case-sensitive)', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey'],
      [{ slug: 'IPhone-15', categorySegment: 'Smartphones' }]
    );

    expect(urls).toEqual([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/Smartphones/IPhone-15',
      'https://ogabassey.com/products/IPhone-15',
      'https://ogabassey.com/Smartphones',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/Smartphones/IPhone-15',
      'https://www.ogabassey.com/products/IPhone-15',
      'https://www.ogabassey.com/Smartphones',
    ]);
  });

  it('dedupes entries case-insensitively and drops blank slugs', () => {
    const urls = buildStorefrontProductPurgeUrls(
      ['ogabassey', 'ogabassey.com'],
      [
        { slug: 'iphone-15', categorySegment: 'smartphones' },
        { slug: 'IPHONE-15', categorySegment: 'SMARTPHONES' },
        { slug: '   ', categorySegment: 'smartphones' },
      ]
    );

    // 'ogabassey' and 'ogabassey.com' resolve to the same policy (hostname set
    // emitted once); the case-duplicate entry and the blank slug are dropped.
    expect(urls).toEqual([
      'https://ogabassey.com/',
      'https://ogabassey.com/products',
      'https://ogabassey.com/smartphones/iphone-15',
      'https://ogabassey.com/products/iphone-15',
      'https://ogabassey.com/smartphones',
      'https://www.ogabassey.com/',
      'https://www.ogabassey.com/products',
      'https://www.ogabassey.com/smartphones/iphone-15',
      'https://www.ogabassey.com/products/iphone-15',
      'https://www.ogabassey.com/smartphones',
    ]);
  });

  it('returns an empty list for storefronts without a public cache policy', () => {
    expect(
      buildStorefrontProductPurgeUrls('unknown-store'.split(','), [
        { slug: 'iphone-15', categorySegment: 'smartphones' },
      ])
    ).toEqual([]);
  });

  it('returns an empty list when there are no identifiers', () => {
    expect(
      buildStorefrontProductPurgeUrls([], [{ slug: 'iphone-15' }])
    ).toEqual([]);
  });

  it('returns an empty list when there are no entries', () => {
    expect(buildStorefrontProductPurgeUrls(['ogabassey'], [])).toEqual([]);
  });

  it('returns an empty list when every entry has a blank slug', () => {
    expect(
      buildStorefrontProductPurgeUrls(['ogabassey'], [{ slug: '  ' }])
    ).toEqual([]);
  });
});
