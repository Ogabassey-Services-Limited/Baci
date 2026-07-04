import { describe, expect, it } from 'vitest';
import {
  collectStorefrontContentLinkTargets,
  isDeadStorefrontContentHref,
  rewriteStorefrontContentHref,
} from '@/lib/storefront-content-link-targets';

describe('collectStorefrontContentLinkTargets', () => {
  it('returns empty collections for empty content', () => {
    expect(collectStorefrontContentLinkTargets('')).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('collects blog slugs from raw HTML href attributes', () => {
    const html = '<p><a href="/blog/unpublished-draft">Draft</a></p>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: ['unpublished-draft'],
      productSlugs: [],
    });
  });

  it('collects product slugs from /products/<slug> hrefs', () => {
    const html = '<p><a href="/products/missing-widget">Widget</a></p>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: ['missing-widget'],
    });
  });

  it('classifies category-alias hrefs (legacy keys and canonical values) as product links', () => {
    const html =
      '<a href="/smartphones/iphone-15">Phone</a>' +
      '<a href="/phones/iphone-14">Legacy phone</a>' +
      '<a href="/laptops/macbook-air">Laptop</a>' +
      '<a href="/accessories/case">Case</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: ['case', 'iphone-14', 'iphone-15', 'macbook-air'],
    });
  });

  it('collects hrefs from TipTap JSON link marks', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Read more',
              marks: [{ type: 'link', attrs: { href: '/blog/tiptap-draft' } }],
            },
          ],
        },
      ],
    });

    expect(collectStorefrontContentLinkTargets(json)).toEqual({
      blogSlugs: ['tiptap-draft'],
      productSlugs: [],
    });
  });

  it('collects hrefs from markdown link syntax', () => {
    const markdown = 'See [this post](/blog/markdown-draft) for details.';

    expect(collectStorefrontContentLinkTargets(markdown)).toEqual({
      blogSlugs: ['markdown-draft'],
      productSlugs: [],
    });
  });

  it('ignores 3-segment paths', () => {
    const html = '<a href="/laptops/best-under/x">Deep link</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('ignores 2-segment paths whose first segment is not a recognized internal section', () => {
    const html = '<a href="/about/team">About</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('strips a leading merchant-slug path prefix before classifying', () => {
    const html = '<a href="/ogabassey/blog/merchant-prefixed-draft">Post</a>';

    expect(collectStorefrontContentLinkTargets(html, 'ogabassey')).toEqual({
      blogSlugs: ['merchant-prefixed-draft'],
      productSlugs: [],
    });
  });

  it('does not strip a merchant-slug path prefix when merchantSlug is not provided', () => {
    const html = '<a href="/ogabassey/blog/merchant-prefixed-draft">Post</a>';

    // Without the merchant slug hint this is a 3-segment path, so it is
    // ignored rather than misclassified.
    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('dedupes and sorts collected slugs', () => {
    const html =
      '<a href="/blog/zeta">Z</a><a href="/blog/alpha">A</a><a href="/blog/zeta">Z again</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: ['alpha', 'zeta'],
      productSlugs: [],
    });
  });

  it('rejects slugs with characters outside the allowed slug pattern', () => {
    const html = '<a href="/blog/bad!slug">Bad slug</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('caps collected slugs per kind at 50', () => {
    const hrefs = Array.from(
      { length: 60 },
      (_value, index) =>
        `<a href="/blog/post-${String(index).padStart(2, '0')}">Post ${index}</a>`
    ).join('');

    const result = collectStorefrontContentLinkTargets(hrefs);

    expect(result.blogSlugs).toHaveLength(50);
  });
});

describe('isDeadStorefrontContentHref', () => {
  const deadBlogSlugs = new Set(['draft-post']);
  const deadProductSlugs = new Set(['missing-product']);

  it('returns true for a root-relative href pointing at a dead blog post', () => {
    expect(
      isDeadStorefrontContentHref('/blog/draft-post', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(true);
  });

  it('returns true for a root-relative href pointing at a dead product', () => {
    expect(
      isDeadStorefrontContentHref('/products/missing-product', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(true);
  });

  it('returns false for a live blog post href', () => {
    expect(
      isDeadStorefrontContentHref('/blog/live-post', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(false);
  });

  it('returns false for external URLs', () => {
    expect(
      isDeadStorefrontContentHref('https://example.com/blog/draft-post', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(false);
  });

  it('returns false for protocol-relative URLs', () => {
    expect(
      isDeadStorefrontContentHref('//cdn.example.com/blog/draft-post', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(false);
  });

  it('returns false immediately when both dead-slug sets are empty', () => {
    expect(
      isDeadStorefrontContentHref('/blog/draft-post', {
        deadBlogSlugs: new Set(),
        deadProductSlugs: new Set(),
      })
    ).toBe(false);
  });

  it('strips a matching basePath prefix before classification', () => {
    expect(
      isDeadStorefrontContentHref('/ogabassey/blog/draft-post', {
        basePath: '/ogabassey',
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(true);
  });

  it('ignores query strings and hash fragments when matching', () => {
    expect(
      isDeadStorefrontContentHref('/blog/draft-post?ref=newsletter#top', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(true);
  });

  it('returns false for a href that does not classify as blog or product', () => {
    expect(
      isDeadStorefrontContentHref('/about/team', {
        deadBlogSlugs,
        deadProductSlugs,
      })
    ).toBe(false);
  });
});

describe('rewriteStorefrontContentHref', () => {
  const rewrites = {
    blogSlugs: {
      'buying-a-used-iphone-in-2025':
        'the-ultimate-checklist-for-buying-a-used-iphone-in-2025',
    },
    productPaths: {
      'apple-airpods-2': '/earbuds/apple-airpods-2',
      'iphone-13-pro-6gb-256gb': '/smartphones/iphone-13-pro',
    },
  };

  it('rewrites product links whose category segment is stale', () => {
    expect(
      rewriteStorefrontContentHref('/audio/apple-airpods-2', { rewrites })
    ).toBe('/earbuds/apple-airpods-2');
  });

  it('rewrites consolidated variant links to the parent canonical path', () => {
    expect(
      rewriteStorefrontContentHref('/smartphones/iphone-13-pro-6gb-256gb', {
        rewrites,
      })
    ).toBe('/smartphones/iphone-13-pro');
  });

  it('rewrites renamed blog post links to the live slug', () => {
    expect(
      rewriteStorefrontContentHref('/blog/buying-a-used-iphone-in-2025', {
        rewrites,
      })
    ).toBe('/blog/the-ultimate-checklist-for-buying-a-used-iphone-in-2025');
  });

  it('preserves a basePath prefix and query/hash suffix', () => {
    expect(
      rewriteStorefrontContentHref(
        '/my-store/audio/apple-airpods-2?utm_source=blog#specs',
        { basePath: '/my-store', rewrites }
      )
    ).toBe('/my-store/earbuds/apple-airpods-2?utm_source=blog#specs');
  });

  it('returns null when the href is already canonical', () => {
    expect(
      rewriteStorefrontContentHref('/earbuds/apple-airpods-2', { rewrites })
    ).toBeNull();
  });

  it('returns null for external and non-internal hrefs', () => {
    expect(
      rewriteStorefrontContentHref(
        'https://example.com/audio/apple-airpods-2',
        {
          rewrites,
        }
      )
    ).toBeNull();
    expect(
      rewriteStorefrontContentHref('//evil.example/x', { rewrites })
    ).toBeNull();
    expect(rewriteStorefrontContentHref('/checkout', { rewrites })).toBeNull();
  });

  it('returns null when no rewrites are known', () => {
    expect(
      rewriteStorefrontContentHref('/audio/apple-airpods-2', {
        rewrites: { blogSlugs: {}, productPaths: {} },
      })
    ).toBeNull();
  });
});
