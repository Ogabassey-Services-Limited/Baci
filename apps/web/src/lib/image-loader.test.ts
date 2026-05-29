import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from '@/lib/image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rewrites OgaBassey CDN image URLs to the CDN transformer', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(
      'https://cdn.ogabassey.com/image/width=800,quality=75,format=auto/core-assets/products/iphone.avif'
    );
  });

  it('negotiates CDN output formats for OgaBassey image URLs', () => {
    const urlJpg = 'https://cdn.ogabassey.com/core-assets/products/image.jpg';
    expect(imageLoader({ src: urlJpg, width: 800 })).toContain('format=auto');

    const urlPng = 'https://cdn.ogabassey.com/core-assets/products/image.png';
    expect(imageLoader({ src: urlPng, width: 800 })).toContain('format=auto');

    const urlWebp = 'https://cdn.ogabassey.com/core-assets/products/image.webp';
    expect(imageLoader({ src: urlWebp, width: 800 })).toContain('format=auto');
  });

  it('passes custom quality to the OgaBassey CDN transformer', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=auto/core-assets/products/iphone.avif'
    );
  });

  it('clamps OgaBassey CDN transformer dimensions and quality', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 9000, quality: 0 })).toBe(
      'https://cdn.ogabassey.com/image/width=3840,quality=1,format=auto/core-assets/products/iphone.avif'
    );
  });

  it('preserves hash fragments on transformed OgaBassey CDN URLs', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif#1';
    expect(imageLoader({ src: url, width: 800 })).toBe(
      'https://cdn.ogabassey.com/image/width=800,quality=75,format=auto/core-assets/products/iphone.avif#1'
    );
  });

  it('clamps high OgaBassey CDN transformer quality values', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 9000, quality: 999 })).toBe(
      'https://cdn.ogabassey.com/image/width=3840,quality=100,format=auto/core-assets/products/iphone.avif'
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

  it('adds loader params to OgaBassey CDN URLs with query strings', () => {
    const url = 'https://cdn.ogabassey.com/img.avif?v=1';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
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

  it('leaves already transformed OgaBassey CDN URLs unchanged', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=229,quality=75,format=webp/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('adds width and quality to format-only transformed OgaBassey CDN URLs', () => {
    const url =
      'https://cdn.ogabassey.com/image/format=auto/core-assets/blog/codex/post-landscape_16x9.jpg';
    expect(imageLoader({ src: url, width: 192, quality: 80 })).toBe(
      'https://cdn.ogabassey.com/image/width=192,quality=80,format=auto/core-assets/blog/codex/post-landscape_16x9.jpg'
    );
  });

  it('preserves existing quality on format-only transformed OgaBassey CDN URLs', () => {
    const url =
      'https://cdn.ogabassey.com/image/quality=60,format=auto/core-assets/blog/codex/post-landscape_16x9.jpg?v=1#main';
    expect(imageLoader({ src: url, width: 96, quality: 80 })).toBe(
      'https://cdn.ogabassey.com/image/width=96,quality=60,format=auto/core-assets/blog/codex/post-landscape_16x9.jpg?v=1#main'
    );
  });

  it('adds width and quality to transformed OgaBassey CDN URLs with multiple operations', () => {
    const url =
      'https://cdn.ogabassey.com/image/format=auto,blur=5/core-assets/blog/codex/post-landscape_16x9.jpg';
    expect(imageLoader({ src: url, width: 320, quality: 70 })).toBe(
      'https://cdn.ogabassey.com/image/width=320,quality=70,format=auto,blur=5/core-assets/blog/codex/post-landscape_16x9.jpg'
    );
  });

  it('falls back to loader params for malformed transformed OgaBassey CDN URLs', () => {
    expect(
      imageLoader({
        src: 'https://cdn.ogabassey.com/image/format=auto',
        width: 96,
      })
    ).toBe('https://cdn.ogabassey.com/image/format=auto?w=96&q=75');

    expect(
      imageLoader({
        src: 'https://cdn.ogabassey.com/image//path.jpg',
        width: 96,
      })
    ).toBe('https://cdn.ogabassey.com/image//path.jpg?w=96&q=75');
  });

  it('leaves already transformed OgaBassey CDN URLs with query and hash unchanged', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=229,quality=75,format=webp/core-assets/products/iphone.avif?v=1#main';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('does not treat non-transform CDN paths as already transformed', () => {
    expect(
      imageLoader({
        src: 'https://cdn.ogabassey.com/images/phone.jpg',
        width: 640,
      })
    ).toBe(
      'https://cdn.ogabassey.com/image/width=640,quality=75,format=auto/images/phone.jpg'
    );
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
