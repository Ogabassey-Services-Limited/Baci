import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';

const NativeURL = URL;

describe('normalizeStorefrontContentHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns early for empty strings', () => {
    expect(normalizeStorefrontContentHref('', {})).toBe('');
  });

  it('returns hash-only links unchanged', () => {
    expect(normalizeStorefrontContentHref('#', {})).toBe('#');
    expect(normalizeStorefrontContentHref('#fragment', {})).toBe('#fragment');
  });

  it('returns mailto and tel links unchanged', () => {
    expect(normalizeStorefrontContentHref('mailto:hello@example.com', {})).toBe(
      'mailto:hello@example.com'
    );
    expect(normalizeStorefrontContentHref('tel:+2348000000000', {})).toBe(
      'tel:+2348000000000'
    );
  });

  it('returns protocol-relative urls unchanged', () => {
    expect(
      normalizeStorefrontContentHref('//cdn.example.com/image.png', {
        baseUrl: 'https://ogabassey.com',
      })
    ).toBe('//cdn.example.com/image.png');
  });

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

  it('collapses the /categories/<slug> alias to a category page', () => {
    expect(
      normalizeStorefrontContentHref('/categories/smartphones', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/smartphones');
  });

  it('collapses bare /categories and /categories/ links to the products index', () => {
    expect(
      normalizeStorefrontContentHref('/categories', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/products');

    expect(
      normalizeStorefrontContentHref('/categories/', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/products');
  });

  it('collapses WordPress-era /categories/product/ links to the products index like /category/', () => {
    expect(
      normalizeStorefrontContentHref('/categories/product/iphone-15', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/products');
  });

  it('normalizes legacy category aliases under the /categories/ alias path', () => {
    expect(
      normalizeStorefrontContentHref('/categories/phones', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/smartphones');
  });

  it('normalizes /categories/<slug>/<product-slug> links on absolute custom-domain urls', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/categories/phones/iphone-15',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/smartphones/iphone-15');
  });

  it('collapses legacy merchant-prefixed /categories/ links in path-mode storefronts', () => {
    expect(
      normalizeStorefrontContentHref('/ogabassey/categories/phones/iphone-15', {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/ogabassey/smartphones/iphone-15');
  });

  it('normalizes legacy /phone links to smartphones and preserves non-tracking params', () => {
    expect(
      normalizeStorefrontContentHref('/phone/iphone-15?ref=home#details', {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/ogabassey/smartphones/iphone-15?ref=home#details');
  });

  it('normalizes legacy /laptop links to laptops for absolute storefront URLs', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/laptop/macbook-air-m4#specs',
        {
          basePath: '/ogabassey',
          baseUrl: 'https://usebaci.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/ogabassey/laptops/macbook-air-m4#specs');
  });

  it('preserves merchant-defined samsung/macbook category slugs in root-relative links', () => {
    expect(
      normalizeStorefrontContentHref(
        '/samsung/samsung-galaxy-s25-ultra-12gb-512gb',
        {
          basePath: '/ogabassey',
          baseUrl: 'https://usebaci.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/ogabassey/samsung/samsung-galaxy-s25-ultra-12gb-512gb');

    expect(
      normalizeStorefrontContentHref('/macbook/macbook-air-13-inch-2020-m1', {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/ogabassey/macbook/macbook-air-13-inch-2020-m1');
  });

  it('corrects the misspelled accesories path mapping', () => {
    expect(
      normalizeStorefrontContentHref('/accesories/chargers?ref=nav', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/accessories/chargers?ref=nav');
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

  it('normalizes root-relative links, drops tracking query strings, and preserves hashes', () => {
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

  it('neutralizes encoded markup in root-relative internal paths', () => {
    expect(
      normalizeStorefrontContentHref(
        '/smartphones%3Eogabassey%20smartphones%3C/a%3E%20catalog%20and%20compare%20live%20stock',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('#');
  });

  it('neutralizes raw markup in absolute internal URLs', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://ogabassey.com/tablets>Tablets</a> category. This is text',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('#');
  });

  it('preserves encoded spaces in valid internal product URLs', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://ogabassey.com/smart%20watches/watch%20pro%20%2B%20gps',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/smart%20watches/watch%20pro%20%2B%20gps');
  });

  it('rejects encoded markup even when another malformed percent escape is present', () => {
    expect(
      normalizeStorefrontContentHref(
        '/phones%3Eogabassey%20phones%3C/a%3E%20save%2010%%20today',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('#');

    expect(
      normalizeStorefrontContentHref('/smartphones%3Eogabassey%FF', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('#');
  });

  it('neutralizes captured markup in internal query parameters', () => {
    expect(
      normalizeStorefrontContentHref(
        '/smartphones?label=%3Eogabassey%20smartphones%3C/a%3E%20catalog%20and%20compare',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('#');
  });

  it('preserves safe query parameters with encoded spaces and quotes', () => {
    expect(
      normalizeStorefrontContentHref(
        '/smartphones?label=watch%20pro&q=%22student%20deal%22&ref=blog',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/smartphones?label=watch+pro&q=%22student+deal%22&ref=blog');
  });

  it('neutralizes oversized internal hrefs', () => {
    expect(
      normalizeStorefrontContentHref(`/smartphones?label=${'a'.repeat(2100)}`, {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('#');
  });

  it('neutralizes unsafe root-relative hrefs when URL parsing fails', () => {
    class ThrowingRootRelativeURL extends NativeURL {
      constructor(url: string | URL, base?: string | URL) {
        if (base === 'https://storefront.invalid') {
          throw new TypeError('forced root-relative parser failure');
        }
        super(url, base);
      }
    }

    vi.stubGlobal('URL', ThrowingRootRelativeURL);

    expect(
      normalizeStorefrontContentHref('/smartphones>captured', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('#');

    expect(
      normalizeStorefrontContentHref("/smartphones'injection", {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('#');

    expect(
      normalizeStorefrontContentHref('/smart%20watches/watch%20pro', {
        basePath: '',
        baseUrl: 'https://ogabassey.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('/smart%20watches/watch%20pro');
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

  it('preserves nested product-category paths after normalizing the category slug', () => {
    expect(
      normalizeStorefrontContentHref(
        'https://www.ogabassey.com/product-category/phones/iphone-15-pro-max',
        {
          basePath: '',
          baseUrl: 'https://ogabassey.com',
          merchantSlug: 'ogabassey',
        }
      )
    ).toBe('/smartphones/iphone-15-pro-max');
  });
  it('does not treat non-platform lookalike subdomains as internal storefront links', () => {
    expect(
      normalizeStorefrontContentHref('https://ogabassey.example.com/phones/x', {
        basePath: '/ogabassey',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'ogabassey',
      })
    ).toBe('https://ogabassey.example.com/phones/x');
  });

  it('does not collapse a leading custom-domain path segment without a merchant slug', () => {
    expect(
      normalizeStorefrontContentHref('/shop/phones/iphone-15', {
        basePath: '',
        baseUrl: 'https://shop.example.com',
      })
    ).toBe('/shop/phones/iphone-15');
  });

  it('neutralizes dangerous scripting schemes', () => {
    expect(normalizeStorefrontContentHref('javascript:alert(1)', {})).toBe('#');
    expect(
      normalizeStorefrontContentHref(
        'data:text/html,<script>alert(1)</script>',
        {}
      )
    ).toBe('#');
    expect(normalizeStorefrontContentHref('vbscript:msgbox("x")', {})).toBe(
      '#'
    );
  });

  it('treats multi-part TLD custom domains as internal storefront links', () => {
    expect(
      normalizeStorefrontContentHref('https://mystore.com.ng/phones/x', {
        basePath: '/mystore',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'mystore',
      })
    ).toBe('/mystore/smartphones/x');

    expect(
      normalizeStorefrontContentHref('https://www.mystore.com.ng/phones/x', {
        basePath: '/mystore',
        baseUrl: 'https://usebaci.com',
        merchantSlug: 'mystore',
      })
    ).toBe('/mystore/smartphones/x');
  });
});
