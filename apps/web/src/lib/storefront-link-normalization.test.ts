import { describe, expect, it } from 'vitest';
import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';

describe('normalizeStorefrontContentHref', () => {
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
