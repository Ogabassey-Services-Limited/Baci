import { describe, expect, it } from 'vitest';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

describe('buildStorefrontRedirect', () => {
  it('returns slug-prefixed path when no proxy headers', () => {
    expect(
      buildStorefrontRedirect(new Headers(), 'ogabassey', '/about', {})
    ).toBe('/ogabassey/about');
  });

  it('returns root-relative path for custom-domain storefronts', () => {
    expect(
      buildStorefrontRedirect(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey',
        '/about',
        {}
      )
    ).toBe('/about');
  });

  it('appends a single query param', () => {
    expect(
      buildStorefrontRedirect(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey',
        '/blog',
        { utm_source: 'email' }
      )
    ).toBe('/blog?utm_source=email');
  });

  it('appends multi-value query params', () => {
    const result = buildStorefrontRedirect(
      new Headers([['x-custom-domain', 'ogabassey.com']]),
      'ogabassey',
      '/blog',
      { tag: ['a', 'b'] }
    );
    expect(result).toBe('/blog?tag=a&tag=b');
  });

  it('preserves empty-string query values', () => {
    expect(
      buildStorefrontRedirect(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey',
        '/blog',
        { q: '' }
      )
    ).toBe('/blog?q=');
  });

  it('drops undefined query values', () => {
    expect(
      buildStorefrontRedirect(
        new Headers([['x-custom-domain', 'ogabassey.com']]),
        'ogabassey',
        '/blog',
        { q: undefined }
      )
    ).toBe('/blog');
  });
});
