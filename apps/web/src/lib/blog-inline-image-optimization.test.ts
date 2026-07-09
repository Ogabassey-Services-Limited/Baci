import { describe, expect, it } from 'vitest';
import {
  BLOG_INLINE_IMAGE_SIZES,
  buildInlineImageSiblings,
  isLegacyOgabasseyCdnBlogImage,
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

describe('isLegacyOgabasseyCdnBlogImage', () => {
  it('detects absolute old WordPress-style OgaBassey CDN blog images', () => {
    expect(
      isLegacyOgabasseyCdnBlogImage(
        `${CDN}/blog/2024/06/Redmi-13-4-768x960-1.jpg`
      )
    ).toBe(true);
  });

  it('does not apply the OgaBassey stale-image denylist to relative paths', () => {
    expect(
      isLegacyOgabasseyCdnBlogImage('/blog/2024/06/Redmi-13-4-768x960-1.jpg')
    ).toBe(false);
  });

  it('returns false for malformed absolute URLs', () => {
    expect(isLegacyOgabasseyCdnBlogImage('https://[bad-url')).toBe(false);
  });

  it('does not flag managed blog images or external images', () => {
    expect(
      isLegacyOgabasseyCdnBlogImage(
        `${CDN}/core-assets/blog/x/inline-1-b9244d7a754d.png`
      )
    ).toBe(false);
    expect(
      isLegacyOgabasseyCdnBlogImage(
        `${CDN}/blog/2025/12/chip-unlocked-hero.png`
      )
    ).toBe(false);
    expect(
      isLegacyOgabasseyCdnBlogImage(
        'https://cdn.example.com/blog/2024/06/photo.jpg'
      )
    ).toBe(false);
  });

  it('does not apply the OgaBassey stale-image denylist to configured CDN origins', () => {
    const prev = process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
    process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN = 'https://media.example.com';
    try {
      expect(
        isLegacyOgabasseyCdnBlogImage(
          'https://media.example.com/blog/2024/06/Redmi-13-4-768x960-1.jpg'
        )
      ).toBe(false);
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
    // Per-format sibling FILES: base png stays png (`format=png`), the
    // `.png.avif`/`.png.webp` siblings transcode to their own extension. Never
    // `format=auto` — CF Free ignores Vary, so an Accept-negotiated URL is one
    // shared cache body that could serve AVIF into the png <img> fallback.
    expect(siblings.fallback).toContain('width=828,quality=70,format=png');
    expect(siblings.avifSrcSet).toContain(
      'width=384,quality=70,format=avif/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.avif 384w'
    );
    expect(siblings.webpSrcSet).toContain(
      'width=1200,quality=70,format=webp/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.webp 1200w'
    );
    expect(siblings.fallbackSrcSet).toContain(
      'width=640,quality=70,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 640w'
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
        'https://media.example.com/image/width=828,quality=70,format=png/core-assets/blog/x/inline-1-b9244d7a754d.png'
      );
      expect(siblings.avifSrcSet).toContain(
        'https://media.example.com/image/width=384,quality=70,format=avif/core-assets/blog/x/inline-1-b9244d7a754d.png.avif 384w'
      );
      expect(siblings.webpSrcSet).toContain(
        'https://media.example.com/image/width=1200,quality=70,format=webp/core-assets/blog/x/inline-1-b9244d7a754d.png.webp 1200w'
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
      'width=828,quality=70,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png?v=2'
    );
    expect(siblings.avifSrcSet).toContain(
      'width=384,quality=70,format=avif/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.avif?v=2 384w'
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

    expect(siblings.fallback).toContain('width=828,quality=35,format=png');
    expect(siblings.fallbackSrcSet).toContain(
      'width=640,quality=35,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 640w'
    );
  });

  it('overrides pinned CDN formats for generated avif/webp sibling files while preserving quality', () => {
    const pinnedFormatSrc = `${CDN}/image/quality=35,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png`;
    const siblings = buildInlineImageSiblings(pinnedFormatSrc);

    expect(siblings.fallback).toContain('width=828,quality=35,format=png');
    expect(siblings.avifSrcSet).toContain(
      'width=640,quality=35,format=avif/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.avif 640w'
    );
    expect(siblings.webpSrcSet).toContain(
      'width=640,quality=35,format=webp/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png.webp 640w'
    );
    expect(siblings.avifSrcSet).not.toContain('format=png');
    expect(siblings.webpSrcSet).not.toContain('format=png');
  });

  it('rebuilds pinned CDN dimensions for each responsive srcset width', () => {
    const pinnedWidthSrc = `${CDN}/image/width=1600,height=900,quality=50,format=auto/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png`;
    const siblings = buildInlineImageSiblings(pinnedWidthSrc);

    expect(siblings.fallback).toContain('width=828,quality=50,format=png');
    expect(siblings.fallback).not.toContain('width=1600');
    expect(siblings.fallback).not.toContain('height=900');
    expect(siblings.fallbackSrcSet).toContain(
      'width=384,quality=50,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 384w'
    );
    expect(siblings.fallbackSrcSet).toContain(
      'width=1200,quality=50,format=png/core-assets/blog/codex/post-token/inline-1-b9244d7a754d.png 1200w'
    );
  });
});
