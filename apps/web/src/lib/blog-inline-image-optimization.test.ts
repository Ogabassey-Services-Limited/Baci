import { describe, expect, it } from 'vitest';
import {
  BLOG_INLINE_IMAGE_SIZES,
  buildInlineImageSiblings,
  isTrustedCdnInlineImage,
} from './blog-inline-image-optimization';

const CDN = 'https://cdn.ogabassey.com';
const INLINE = `${CDN}/image/format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png`;

describe('isTrustedCdnInlineImage', () => {
  it('accepts trusted CDN inline images with generated sibling markers', () => {
    expect(isTrustedCdnInlineImage(INLINE)).toBe(true);
    expect(
      isTrustedCdnInlineImage(
        `${CDN}/core-assets/blog/x/inline-2-b9244d7a754d.png`
      )
    ).toBe(true);
    // Publisher also supports jpg/jpeg inline images.
    expect(
      isTrustedCdnInlineImage(
        `${CDN}/core-assets/blog/x/inline-3-b9244d7a754d.jpg`
      )
    ).toBe(true);
    expect(
      isTrustedCdnInlineImage(
        `${CDN}/core-assets/blog/x/inline-4-b9244d7a754d.jpeg`
      )
    ).toBe(true);
  });

  it('rejects legacy inline images without generated sibling markers', () => {
    expect(
      isTrustedCdnInlineImage(`${CDN}/core-assets/blog/x/inline-12.png`)
    ).toBe(false);
  });

  it('rejects external, non-inline, sibling, and empty URLs', () => {
    // The generated siblings themselves must not re-match.
    expect(isTrustedCdnInlineImage(`${INLINE}.avif`)).toBe(false);
    expect(isTrustedCdnInlineImage(`${INLINE}.webp`)).toBe(false);
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
        isTrustedCdnInlineImage(
          'https://media.example.com/blog/x/inline-1-b9244d7a754d.png'
        )
      ).toBe(true);
    } finally {
      if (prev === undefined) {
        delete process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
      } else {
        process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = prev;
      }
    }
  });
});

describe('buildInlineImageSiblings', () => {
  it('appends .avif/.webp to the inline png URL and exposes responsive candidates', () => {
    const siblings = buildInlineImageSiblings(INLINE);

    expect(siblings).toMatchObject({
      avif: `${INLINE}.avif`,
      webp: `${INLINE}.webp`,
      sizes: BLOG_INLINE_IMAGE_SIZES,
      width: undefined,
      height: undefined,
    });
    expect(siblings.fallback).toContain('width=828,quality=70,format=auto');
    expect(siblings.avifSrcSet).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.avif 384w'
    );
    expect(siblings.webpSrcSet).toContain(
      'width=1200,quality=70,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.webp 1200w'
    );
    expect(siblings.fallbackSrcSet).toContain(
      'width=640,quality=70,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 640w'
    );
  });

  it('preserves responsive width transforms for a configured blog CDN origin', () => {
    const prev = process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = 'https://media.example.com';
    try {
      const src =
        'https://media.example.com/image/format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png';
      const siblings = buildInlineImageSiblings(src);

      expect(siblings.fallback).toContain(
        'https://media.example.com/image/width=828,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png'
      );
      expect(siblings.avifSrcSet).toContain(
        'https://media.example.com/image/width=384,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.avif 384w'
      );
      expect(siblings.webpSrcSet).toContain(
        'https://media.example.com/image/width=1200,quality=70,format=auto/core-assets/blog/x/inline-1-b9244d7a754d.png.webp 1200w'
      );
    } finally {
      if (prev === undefined) {
        delete process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
      } else {
        process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = prev;
      }
    }
  });

  it('inserts the suffix before any query/hash', () => {
    const siblings = buildInlineImageSiblings(`${INLINE}?v=2`);

    expect(siblings.avif).toBe(`${INLINE}.avif?v=2`);
    expect(siblings.webp).toBe(`${INLINE}.webp?v=2`);
    expect(siblings.fallback).toContain(
      'width=828,quality=70,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png?v=2'
    );
    expect(siblings.avifSrcSet).toContain(
      'width=384,quality=70,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.avif?v=2 384w'
    );
  });
  it('preserves explicit inline image dimensions when provided', () => {
    const siblings = buildInlineImageSiblings(INLINE, {
      height: 1200,
      width: 900,
    });

    expect(siblings.width).toBe(900);
    expect(siblings.height).toBe(1200);
  });

  it('preserves an existing CDN quality transform while adding responsive widths', () => {
    const lowQualitySrc = `${CDN}/image/quality=35,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png`;
    const siblings = buildInlineImageSiblings(lowQualitySrc);

    expect(siblings.fallback).toContain('width=828,quality=35,format=auto');
    expect(siblings.fallbackSrcSet).toContain(
      'width=640,quality=35,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 640w'
    );
  });
});
