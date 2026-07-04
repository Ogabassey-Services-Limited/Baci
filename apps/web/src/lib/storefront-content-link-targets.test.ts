import { describe, expect, it } from 'vitest';
import {
  collectStorefrontContentLinkTargets,
  isDeadStorefrontContentHref,
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

  it('collects hrefs from markdown links that include a title', () => {
    const markdown = 'See [this post](/blog/titled-draft "Read the guide").';

    expect(collectStorefrontContentLinkTargets(markdown)).toEqual({
      blogSlugs: ['titled-draft'],
      productSlugs: [],
    });
  });

  it('collects unquoted href attributes from legacy HTML', () => {
    const html = '<a href=/blog/unquoted-draft>Old style</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: ['unquoted-draft'],
      productSlugs: [],
    });
  });

  it('collects reference-style markdown link definitions', () => {
    const markdown =
      'See [the guide][draft] for details.\n\n[draft]: /blog/reference-draft\n[other]: </products/reference-widget>';

    expect(collectStorefrontContentLinkTargets(markdown)).toEqual({
      blogSlugs: ['reference-draft'],
      productSlugs: ['reference-widget'],
    });
  });

  it('classifies products under a merchant category slugged compare', () => {
    const html = '<a href="/compare/galaxy-s25-ultra">Compare-category PDP</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: ['galaxy-s25-ultra'],
    });
  });

  it('collects inline markdown links with angle-bracket destinations', () => {
    const markdown = 'Read [the draft](</blog/angled-draft>) today.';

    expect(collectStorefrontContentLinkTargets(markdown)).toEqual({
      blogSlugs: ['angled-draft'],
      productSlugs: [],
    });
  });

  it('never classifies blog utility routes as post slugs', () => {
    const html =
      '<a href="/blog/news-sitemap.xml">Sitemap</a>' +
      '<a href="/blog/author">Authors</a>' +
      '<a href="/blog/category">Categories</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
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

  it('collects product slugs from legacy /categories/<category>/<slug> paths', () => {
    // These are 3-segment in raw content but normalize to the canonical
    // 2-segment PDP shape before classification.
    const html =
      '<a href="/categories/phones/iphone-15">iPhone</a>' +
      '<a href="/category/laptops/dell-xps-13">Dell</a>' +
      '<a href="/product-category/accesories/magic-mouse">Mouse</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: ['dell-xps-13', 'iphone-15', 'magic-mouse'],
    });
  });

  it('collects targets from absolute merchant-domain URLs', () => {
    const html =
      '<a href="https://ogabassey.com/categories/smartphones/tecno-pop-10">Tecno</a>' +
      '<a href="https://ogabassey.com/blog/some-draft-post">Post</a>' +
      '<a href="https://example.com/blog/external-post">External</a>';

    expect(collectStorefrontContentLinkTargets(html, 'ogabassey')).toEqual({
      blogSlugs: ['some-draft-post'],
      productSlugs: ['tecno-pop-10'],
    });
  });

  it('collects targets from absolute URLs on custom domains unrelated to the merchant slug', () => {
    // Without baseUrl these would be skipped as external — the hostname does
    // not contain the merchant slug.
    const html =
      '<a href="https://gadgetstore.example/blog/draft-on-custom-domain">Post</a>';

    expect(
      collectStorefrontContentLinkTargets(
        html,
        'ogabassey',
        'https://gadgetstore.example'
      )
    ).toEqual({
      blogSlugs: ['draft-on-custom-domain'],
      productSlugs: [],
    });
  });

  it('ignores 2-segment paths under segments that own static multi-segment routes', () => {
    const html =
      '<a href="/checkout/success">Done</a>' +
      '<a href="/account/orders">Orders</a>' +
      '<a href="/pages/about">About</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: [],
    });
  });

  it('classifies merchant categories that shadow single-segment utility pages', () => {
    // /repair and /returns have static single-segment pages, but a
    // two-segment URL under them is served by the PDP catch-all.
    const html =
      '<a href="/repair/iphone-screen-fix">Repair product</a>' +
      '<a href="/returns/returned-widget">Returns product</a>';

    expect(collectStorefrontContentLinkTargets(html)).toEqual({
      blogSlugs: [],
      productSlugs: ['iphone-screen-fix', 'returned-widget'],
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

  it('unwraps dead products under merchant-defined category segments', () => {
    // Broad classification at render must match broad collection: the dead
    // set only ever contains DB-confirmed dead slugs, so membership decides.
    expect(
      isDeadStorefrontContentHref('/audio/missing-widget', {
        deadBlogSlugs,
        deadProductSlugs: new Set(['missing-widget']),
      })
    ).toBe(true);

    // Segments owning static multi-segment routes never classify as
    // product links, so a coincidental dead slug cannot unwrap them.
    expect(
      isDeadStorefrontContentHref('/checkout/missing-widget', {
        deadBlogSlugs,
        deadProductSlugs: new Set(['missing-widget']),
      })
    ).toBe(false);
  });

  it('never unwraps blog utility routes even when present in the dead set', () => {
    expect(
      isDeadStorefrontContentHref('/blog/news-sitemap.xml', {
        deadBlogSlugs: new Set(['news-sitemap.xml']),
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

describe('collectStorefrontContentLinkTargets broad-mode fallback', () => {
  it('collects product slugs under merchant-defined category segments', () => {
    const targets = collectStorefrontContentLinkTargets(
      '<a href="/audio/apple-airpods-2">AirPods</a>' +
        '<a href="/gaming/cyberpunk-2077">Game</a>'
    );

    expect(targets.productSlugs).toEqual(['apple-airpods-2', 'cyberpunk-2077']);
  });

  it('never classifies known non-product segments as products', () => {
    const targets = collectStorefrontContentLinkTargets(
      '<a href="/account/orders">Orders</a><a href="/pages/rewards">Rewards</a>'
    );

    expect(targets.productSlugs).toEqual([]);
    expect(targets.blogSlugs).toEqual([]);
  });
});

describe('collectStorefrontContentLinkTargets markdown titles', () => {
  it('collects destinations from markdown links with quoted titles', () => {
    const targets = collectStorefrontContentLinkTargets(
      '[Guide](/blog/draft-post "read more") and ' +
        "[Buy](/smartphones/iphone-x 'shop now')"
    );

    expect(targets.blogSlugs).toEqual(['draft-post']);
    expect(targets.productSlugs).toEqual(['iphone-x']);
  });
});
