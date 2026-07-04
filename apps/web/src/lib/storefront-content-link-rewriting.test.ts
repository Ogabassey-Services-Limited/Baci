import { describe, expect, it } from 'vitest';
import { rewriteStorefrontContentHref } from '@/lib/storefront-content-link-rewriting';

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
