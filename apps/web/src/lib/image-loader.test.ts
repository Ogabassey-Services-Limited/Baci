import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from '@/lib/image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds width-aware transforms for OgaBassey product CDN images', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(
      'https://cdn.ogabassey.com/image/width=800,quality=75,format=auto/core-assets/products/iphone.avif'
    );
  });

  it('negotiates transformed formats for product image file types', () => {
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
        `https://cdn.ogabassey.com/image/width=800,quality=75,format=auto/core-assets/products/${expectedExtension}`
      );
    }
  });

  it('preserves query strings and hash fragments in transformed product URLs', () => {
    const url =
      'https://cdn.ogabassey.com/core-assets/products/iphone.avif?v=1#main';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=auto/core-assets/products/iphone.avif?v=1#main'
    );
  });

  it('builds transformed OgaBassey CDN URLs for explicit preload callers', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(
      imageLoader({
        preferOgabasseyTransform: true,
        quality: 30,
        src: url,
        width: 750,
      })
    ).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=30,format=auto/core-assets/products/iphone.avif'
    );
  });

  it('injects a width into pre-baked OgaBassey transform URLs that omit one', () => {
    // A pre-baked `/image/format=auto/` URL (no width) would otherwise be
    // returned unchanged, serving the full-resolution asset for every srcset
    // candidate. Inject the requested width so each candidate is sized.
    const url =
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/codex/post-landscape_16x9.jpg';
    expect(imageLoader({ src: url, width: 192, quality: 80 })).toBe(
      'https://cdn.ogabassey.com/image/width=192,quality=80,format=auto/core-assets/blog/codex/post-landscape_16x9.jpg'
    );
  });

  it('produces width-specific URLs across srcset candidates for pre-baked transforms', () => {
    const url =
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/post.jpg';
    expect(imageLoader({ src: url, width: 640 })).toContain(
      '/image/width=640,quality=75,format=auto/'
    );
    expect(imageLoader({ src: url, width: 1080 })).toContain(
      '/image/width=1080,quality=75,format=auto/'
    );
  });

  it('leaves pre-baked transforms with an explicit width untouched', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=320,quality=70,format=auto/core-assets/blog/post.jpg';
    expect(imageLoader({ src: url, width: 1080, quality: 90 })).toBe(url);
  });

  it('preserves query and hash when injecting width into pre-baked transforms', () => {
    const url =
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/post.jpg?v=2#hero';
    expect(imageLoader({ src: url, width: 640, quality: 75 })).toBe(
      'https://cdn.ogabassey.com/image/width=640,quality=75,format=auto/core-assets/blog/post.jpg?v=2#hero'
    );
  });

  it('adds loader params to non-OgaBassey https URLs', () => {
    const url = 'https://example.com/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(`${url}?w=800&q=75`);
  });

  it('adds loader params to http URLs', () => {
    const url = 'http://example.com/image.jpg';
    expect(imageLoader({ src: url, width: 400 })).toBe(`${url}?w=400&q=75`);
  });

  it('returns data URLs directly without modification', () => {
    const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    expect(imageLoader({ src: url, width: 64 })).toBe(url);
  });

  it('returns blob URLs directly without modification', () => {
    const url = 'blob:https://example.com/550e8400-e29b-41d4-a716-446655440000';
    expect(imageLoader({ src: url, width: 64 })).toBe(url);
  });

  it('returns empty strings for invalid runtime src values', () => {
    expect(
      imageLoader({ src: undefined as unknown as string, width: 64 })
    ).toBe('');
    expect(imageLoader({ src: null as unknown as string, width: 64 })).toBe('');
    expect(
      imageLoader({ src: { url: '/hero.jpg' } as unknown as string, width: 64 })
    ).toBe('');
  });

  it('passes width and quality through non-OgaBassey external URLs', () => {
    const url = 'https://cdn.example.com/img.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      `${url}?w=1200&q=90`
    );
  });

  it('serves OgaBassey CDN URLs with query strings directly', () => {
    const url = 'https://cdn.ogabassey.com/img.avif?v=1';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('allows explicit OgaBassey transforms outside product assets', () => {
    const url = 'https://cdn.ogabassey.com/img.avif?v=1';
    expect(
      imageLoader({
        preferOgabasseyTransform: true,
        quality: 90,
        src: url,
        width: 1200,
      })
    ).toBe(
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=auto/img.avif?v=1'
    );
  });

  it('preserves hash fragments when adding loader params', () => {
    expect(imageLoader({ src: '/hero.png#main', width: 200 })).toBe(
      '/hero.png?w=200&q=75#main'
    );
  });

  it('preserves existing query strings and hash fragments', () => {
    expect(imageLoader({ src: '/hero.png?v=1#main', width: 200 })).toBe(
      '/hero.png?v=1&w=200&q=75#main'
    );
  });

  it('preserves explicit OgaBassey CDN transformer URLs with query and hash fragments', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=229,quality=75,format=webp/core-assets/products/iphone.avif?v=1#main';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('serves non-transform OgaBassey CDN paths directly', () => {
    const url = 'https://cdn.ogabassey.com/images/phone.jpg';
    expect(imageLoader({ src: url, width: 640 })).toBe(url);
  });

  it('adds loader params to local public asset paths in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = imageLoader({ src: '/logo.png', width: 256 });
    expect(result).toBe('/logo.png?w=256&q=75');
  });

  it('adds loader params to local public asset paths in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = imageLoader({ src: '/img.png', width: 100, quality: 80 });
    expect(result).toBe('/img.png?w=100&q=80');
  });

  it('passes custom quality through local public assets', () => {
    const result = imageLoader({ src: '/hero.jpg', width: 1920, quality: 90 });
    expect(result).toBe('/hero.jpg?w=1920&q=90');
  });

  it('clamps invalid local dimensions and quality values', () => {
    expect(
      imageLoader({
        src: '/hero.jpg',
        width: Number.NaN,
        quality: Number.POSITIVE_INFINITY,
      })
    ).toBe('/hero.jpg?w=3840&q=75');
  });

  it('clamps low local dimensions and quality values', () => {
    expect(imageLoader({ src: '/hero.jpg', width: 1, quality: 0 })).toBe(
      '/hero.jpg?w=16&q=1'
    );
  });

  it('adds loader params to non-root relative paths', () => {
    const result = imageLoader({ src: 'images/logo.png', width: 100 });
    expect(result).toBe('images/logo.png?w=100&q=75');
  });

  it('returns empty src unchanged', () => {
    const result = imageLoader({ src: '', width: 100 });
    expect(result).toBe('');
  });

  it('adds loader params to protocol-relative URLs', () => {
    const result = imageLoader({
      src: '//cdn.example.com/img.jpg',
      width: 100,
    });
    expect(result).toBe('//cdn.example.com/img.jpg?w=100&q=75');
  });

  it('adds loader params to root-relative paths without encoding', () => {
    const result = imageLoader({
      src: '/path with spaces/img.png',
      width: 200,
    });
    expect(result).toBe('/path with spaces/img.png?w=200&q=75');
  });

  it('adds loader params to SVG public assets in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = imageLoader({ src: '/baci-logo.svg', width: 256 });
    expect(result).toBe('/baci-logo.svg?w=256&q=75');
  });
});
