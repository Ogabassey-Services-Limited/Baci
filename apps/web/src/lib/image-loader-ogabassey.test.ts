import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from '@/lib/image-loader';

const OGABASSEY_CDN_ORIGIN = 'https://cdn.ogabassey.com';

function ogabasseyTransform(
  assetPath: string,
  width: number,
  quality = 75,
  format: 'jpeg' | 'png' = assetPath.includes('.png') ? 'png' : 'jpeg'
): string {
  return `${OGABASSEY_CDN_ORIGIN}/image/width=${width},quality=${quality},format=${format}${assetPath}`;
}

describe('imageLoader OgaBassey CDN handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves OgaBassey product CDN images through width-aware transforms', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(
      ogabasseyTransform('/core-assets/products/iphone.avif', 800)
    );
  });

  it('keeps product image file types on width-aware CDN transform URLs', () => {
    for (const [url, expectedExtension] of [
      [
        'https://cdn.ogabassey.com/core-assets/products/image.avif',
        'image.avif',
      ],
      ['https://cdn.ogabassey.com/core-assets/products/image.jpg', 'image.jpg'],
      ['https://cdn.ogabassey.com/core-assets/products/image.png', 'image.png'],
      [
        'https://cdn.ogabassey.com/core-assets/products/image.webp',
        'image.webp',
      ],
    ]) {
      expect(imageLoader({ src: url, width: 800 })).toBe(
        ogabasseyTransform(`/core-assets/products/${expectedExtension}`, 800)
      );
    }
  });

  it('preserves query strings and hash fragments in product CDN URLs', () => {
    const url =
      'https://cdn.ogabassey.com/core-assets/products/iphone.avif?v=1#main';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      ogabasseyTransform('/core-assets/products/iphone.avif?v=1#main', 1200, 90)
    );
  });

  it('keeps explicit preload callers on width-aware OgaBassey CDN assets', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ quality: 30, src: url, width: 750 })).toBe(
      ogabasseyTransform('/core-assets/products/iphone.avif', 750, 30)
    );
  });

  it('normalizes pre-baked transforms consistently across srcset candidates', () => {
    const url =
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/post.jpg';
    expect(imageLoader({ src: url, width: 640 })).toBe(
      ogabasseyTransform('/core-assets/blog/post.jpg', 640)
    );
    expect(imageLoader({ src: url, width: 1080 })).toBe(
      ogabasseyTransform('/core-assets/blog/post.jpg', 1080)
    );
  });

  it.each([
    [
      'omits a width',
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/codex/post-landscape_16x9.jpg',
      '/core-assets/blog/codex/post-landscape_16x9.jpg',
      192,
      80,
    ],
    [
      'has an explicit width',
      'https://cdn.ogabassey.com/image/width=320,quality=70,format=auto/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      1080,
      90,
    ],
    [
      'has query and hash fragments',
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/post.jpg?v=2#hero',
      '/core-assets/blog/post.jpg?v=2#hero',
      640,
      75,
    ],
    [
      'uses transform params to drop',
      'https://cdn.ogabassey.com/image/format=auto,fit=cover/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      640,
      75,
    ],
    [
      'has pinned quality',
      'https://cdn.ogabassey.com/image/quality=40,format=auto/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      640,
      75,
    ],
    [
      'has a blank width value',
      'https://cdn.ogabassey.com/image/width=,format=auto/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      640,
      75,
    ],
    [
      'has a blank quality value',
      'https://cdn.ogabassey.com/image/quality=,format=auto/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      640,
      75,
    ],
    [
      'uses the `w=` width alias',
      'https://cdn.ogabassey.com/image/w=320,format=auto/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      1080,
      75,
    ],
    [
      'is height constrained',
      'https://cdn.ogabassey.com/image/height=320,fit=cover/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      1080,
      75,
    ],
    [
      'uses quality and format aliases',
      'https://cdn.ogabassey.com/image/q=90,f=webp,fit=cover/core-assets/blog/post.jpg',
      '/core-assets/blog/post.jpg',
      640,
      75,
    ],
  ])('unwraps pre-baked OgaBassey transforms that %s', (_, url, assetPath, width, quality) => {
    expect(imageLoader({ src: url, width, quality })).toBe(
      ogabasseyTransform(assetPath, width, quality)
    );
  });

  it('serves non-transform OgaBassey CDN paths directly', () => {
    const url = 'https://cdn.ogabassey.com/img.avif?v=1';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('keeps explicit OgaBassey transform requests outside product assets direct', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=auto/img.avif?v=1';
    expect(imageLoader({ quality: 90, src: url, width: 1200 })).toBe(url);
  });

  it('unwraps explicit OgaBassey CDN transformer URLs with query and hash fragments', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=229,quality=75,format=webp/core-assets/products/iphone.avif?v=1#main';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      ogabasseyTransform('/core-assets/products/iphone.avif?v=1#main', 1200, 90)
    );
  });

  it('normalizes legacy OgaBassey product image paths to core assets', () => {
    expect(
      imageLoader({
        src: 'https://cdn.ogabassey.com/products/iphone.avif?v=1#main',
        width: 640,
      })
    ).toBe(
      ogabasseyTransform('/core-assets/products/iphone.avif?v=1#main', 640)
    );
  });
});
