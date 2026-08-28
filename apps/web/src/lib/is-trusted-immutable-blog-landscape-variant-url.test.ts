import { afterEach, describe, expect, it } from 'vitest';
import { isTrustedImmutableBlogLandscapeVariantUrl } from '@/lib/is-trusted-immutable-blog-landscape-variant-url';

const ORIGINAL_BLOG_MEDIA_ORIGIN =
  process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;

afterEach(() => {
  if (ORIGINAL_BLOG_MEDIA_ORIGIN === undefined) {
    delete process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
    return;
  }
  process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = ORIGINAL_BLOG_MEDIA_ORIGIN;
});

describe('isTrustedImmutableBlogLandscapeVariantUrl', () => {
  it('accepts immutable landscape variants on the default media origin', () => {
    const result = isTrustedImmutableBlogLandscapeVariantUrl(
      'https://cdn.ogabassey.com/media/merchant/blog/landscape_16x9.webp'
    );

    expect(result).toBe(true);
  });

  it('accepts transformed variants on a configured media origin', () => {
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = 'https://media.example.com';

    const result = isTrustedImmutableBlogLandscapeVariantUrl(
      'https://media.example.com/image/format=auto/core-assets/blog/landscape_16x9.jpg'
    );

    expect(result).toBe(true);
  });

  it('rejects landscape variants from an unconfigured origin', () => {
    const result = isTrustedImmutableBlogLandscapeVariantUrl(
      'https://images.example.com/media/merchant/blog/landscape_16x9.webp'
    );

    expect(result).toBe(false);
  });

  it('rejects non-immutable paths and malformed URLs', () => {
    const arbitraryPath = isTrustedImmutableBlogLandscapeVariantUrl(
      'https://cdn.ogabassey.com/uploads/landscape_16x9.webp'
    );
    const malformedUrl = isTrustedImmutableBlogLandscapeVariantUrl('nope');

    expect(arbitraryPath).toBe(false);
    expect(malformedUrl).toBe(false);
  });
});
