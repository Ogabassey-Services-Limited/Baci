import { describe, expect, it } from 'vitest';
import {
  buildInlineImageSiblings,
  isTrustedCdnInlineImage,
} from './blog-inline-image-optimization';

const CDN = 'https://cdn.ogabassey.com';
const INLINE = `${CDN}/image/format=auto/core-assets/blog/codex/post-token/inline-1.png`;

describe('isTrustedCdnInlineImage', () => {
  it('accepts trusted CDN inline png URLs', () => {
    expect(isTrustedCdnInlineImage(INLINE)).toBe(true);
    expect(
      isTrustedCdnInlineImage(`${CDN}/core-assets/blog/x/inline-12.png`)
    ).toBe(true);
  });

  it('rejects external, non-inline, and empty URLs', () => {
    // External origin — never rewrite arbitrary URLs.
    expect(
      isTrustedCdnInlineImage('https://evil.example.com/inline-1.png')
    ).toBe(false);
    // Featured variant on the same CDN is already optimized — leave it alone.
    expect(
      isTrustedCdnInlineImage(`${CDN}/core-assets/blog/x/landscape_16x9.jpg`)
    ).toBe(false);
    // A look-alike host must not match via substring.
    expect(
      isTrustedCdnInlineImage('https://cdn.ogabassey.com.evil.com/inline-1.png')
    ).toBe(false);
    expect(isTrustedCdnInlineImage(null)).toBe(false);
    expect(isTrustedCdnInlineImage(undefined)).toBe(false);
    expect(isTrustedCdnInlineImage('')).toBe(false);
  });

  it('honors a configured NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN', () => {
    const prev = process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = 'https://media.example.com';
    try {
      expect(
        isTrustedCdnInlineImage('https://media.example.com/blog/x/inline-1.png')
      ).toBe(true);
    } finally {
      if (prev === undefined) {
        process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = undefined;
      } else {
        process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = prev;
      }
    }
  });
});

describe('buildInlineImageSiblings', () => {
  it('appends .avif/.webp to the inline png URL', () => {
    expect(buildInlineImageSiblings(INLINE)).toEqual({
      avif: `${INLINE}.avif`,
      webp: `${INLINE}.webp`,
    });
  });

  it('inserts the suffix before any query/hash', () => {
    expect(buildInlineImageSiblings(`${INLINE}?v=2`)).toEqual({
      avif: `${INLINE}.avif?v=2`,
      webp: `${INLINE}.webp?v=2`,
    });
  });
});
