import { describe, expect, it } from 'vitest';
import { buildStorefrontLocalPath } from '@/lib/build-storefront-local-path';

describe('buildStorefrontLocalPath', () => {
  it('keeps path-based storefront redirects slug-prefixed', () => {
    expect(buildStorefrontLocalPath(new Headers(), 'ogabassey', '/about')).toBe(
      '/ogabassey/about'
    );
  });

  it('returns root-relative paths for custom-domain storefronts', () => {
    expect(
      buildStorefrontLocalPath(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey',
        '/about'
      )
    ).toBe('/about');
  });

  it('returns root-relative paths for subdomain storefronts', () => {
    expect(
      buildStorefrontLocalPath(
        new Headers([['x-merchant-slug', 'ogabassey']]),
        'ogabassey',
        '/contact'
      )
    ).toBe('/contact');
  });

  it('treats domain-like identifiers as domain-routed even without proxy headers', () => {
    expect(
      buildStorefrontLocalPath(new Headers(), 'shop.example.ng', '/blog')
    ).toBe('/blog');
  });
});
