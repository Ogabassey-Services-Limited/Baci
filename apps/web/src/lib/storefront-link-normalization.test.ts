import { describe, expect, it } from 'vitest';
import { rewriteHtmlStorefrontHrefs } from '@/lib/storefront-html-link-rewriting';
import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';

describe('normalizeStorefrontContentHref', () => {
  it('normalizes legacy phones links to smartphones on custom domains', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB?srsltid=test',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/smartphones/iphone-13-pro-6gb-256gb');
  });

  it('collapses legacy wordpress product links to the products index', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/category/product/615',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/products');
  });

  it('maps legacy product-category links to category pages', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/product-category/accessories/',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/accessories');
  });

  it('preserves path-mode storefront prefixes when needed', () => {
    expect(
      normalizeStorefrontContentHref('/phones/iphone-13-pro-6gb-128gb', {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/ogabassey/smartphones/iphone-13-pro-6gb-128gb');
  });

  it('normalizes root-relative links before preserving query strings and hashes', () => {
    expect(
      normalizeStorefrontContentHref(
        '/phones/iPhone-13-Pro-6GB-256GB?utm_source=newsletter#specs',
        {
          basePath: '/ogabassey',
          baseUrl: 'https://usebaci.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/ogabassey/smartphones/iphone-13-pro-6gb-256gb#specs');
  });

  it('normalizes bad path-mode catalog URLs back to the store root path', () => {
    expect(
      normalizeStorefrontContentHref('https://usebaci.com/ogabassey/products', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/products');
  });

  it('leaves external URLs unchanged', () => {
    expect(
      normalizeStorefrontContentHref('https://example.com/phones/iphone', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('https://example.com/phones/iphone');
  });
});

describe('rewriteHtmlStorefrontHrefs', () => {
  it('rewrites internal anchors inside legacy html strings', () => {
    const html =
      '<p><a href="https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB">iPhone</a> <a href="https://www.ogabassey.com/category/product/615">Old product</a></p>';

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toContain(
      '<a href="/smartphones/iphone-13-pro-6gb-256gb">iPhone</a> <a href="/products">Old product</a>'
    );
  });

  it('rewrites single-quoted legacy anchors too', () => {
    const html =
      "<p><a href='https://www.ogabassey.com/phones/iPhone-13-Pro-6GB-256GB'>iPhone</a> <a href='https://www.ogabassey.com/category/product/615'>Old product</a></p>";

    expect(
      rewriteHtmlStorefrontHrefs(html, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toContain(
      "<a href='/smartphones/iphone-13-pro-6gb-256gb'>iPhone</a> <a href='/products'>Old product</a>"
    );
  });
});
