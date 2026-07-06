import { describe, expect, it } from 'vitest';
import {
  getStorefrontPathPrefix,
  resolveStorefrontPathHref,
} from './storefront-path-prefix';

describe('getStorefrontPathPrefix', () => {
  it('prefixes platform path-mode storefront requests with the merchant slug', () => {
    expect(getStorefrontPathPrefix(new Headers(), 'ogabassey')).toBe(
      '/ogabassey'
    );
  });

  it('uses root-relative links for custom-domain storefront requests', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['host', 'ogabassey.com'],
          ['x-custom-domain', 'ogabassey.com'],
        ]),
        { custom_domain: 'ogabassey.com', slug: 'ogabassey' }
      )
    ).toBe('');
  });

  it('uses root-relative links for www custom-domain storefront requests', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['host', 'www.ogabassey.com'],
          ['x-custom-domain', 'ogabassey.com'],
        ]),
        { custom_domain: 'https://ogabassey.com/', slug: 'ogabassey' }
      )
    ).toBe('');
  });

  it('uses root-relative links for subdomain storefront requests', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['host', 'ogabassey.usebaci.com'],
          ['x-merchant-slug', 'ogabassey'],
        ]),
        'ogabassey'
      )
    ).toBe('');
  });

  it('keeps the slug prefix when path-mode requests spoof matching merchant headers', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['host', 'localhost:3000'],
          ['x-custom-domain', 'ogabassey.com'],
          ['x-merchant-slug', 'ogabassey'],
        ]),
        { custom_domain: 'ogabassey.com', slug: 'ogabassey' }
      )
    ).toBe('/ogabassey');
  });

  it('keeps the slug prefix when merchant headers do not match the current storefront', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['x-custom-domain', 'evil.example'],
          ['x-merchant-slug', 'attacker'],
        ]),
        { custom_domain: 'ogabassey.com', slug: 'ogabassey' }
      )
    ).toBe('/ogabassey');
  });

  it('does not trust custom-domain headers without the merchant custom domain', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey'
      )
    ).toBe('/ogabassey');
  });

  it('normalizes configured custom domains before comparing request headers', () => {
    expect(
      getStorefrontPathPrefix(
        new Headers([
          ['host', 'shop.example'],
          ['x-custom-domain', 'shop.example'],
        ]),
        { custom_domain: 'https://SHOP.example/', slug: 'ogabassey' }
      )
    ).toBe('');
  });

  it('prefixes root-relative storefront hrefs', () => {
    expect(resolveStorefrontPathHref('/ogabassey', '/smartphones')).toBe(
      '/ogabassey/smartphones'
    );
  });

  it('normalizes trailing and missing slashes before joining hrefs', () => {
    expect(resolveStorefrontPathHref('/ogabassey/', 'smartphones')).toBe(
      '/ogabassey/smartphones'
    );
  });

  it('does not double-prefix hrefs that already include the storefront path prefix', () => {
    expect(
      resolveStorefrontPathHref('/ogabassey', '/ogabassey/smartphones')
    ).toBe('/ogabassey/smartphones');
  });

  it('keeps root and absolute storefront hrefs stable', () => {
    expect(resolveStorefrontPathHref('/ogabassey', '/')).toBe('/ogabassey');
    expect(
      resolveStorefrontPathHref(
        '/ogabassey',
        'https://ogabassey.com/smartphones'
      )
    ).toBe('https://ogabassey.com/smartphones');
  });

  it('normalizes protocol-relative hrefs into storefront paths', () => {
    expect(resolveStorefrontPathHref('/ogabassey', '//evil.com/path')).toBe(
      '/ogabassey/evil.com/path'
    );
  });
});
