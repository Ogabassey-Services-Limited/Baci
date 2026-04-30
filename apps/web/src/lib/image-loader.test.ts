import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from './image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rewrites OgaBassey CDN image URLs to the CDN transformer', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(
      'https://cdn.ogabassey.com/image/width=800,quality=75,format=webp/core-assets/products/iphone.avif'
    );
  });

  it('passes custom quality to the OgaBassey CDN transformer', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(
      'https://cdn.ogabassey.com/image/width=1200,quality=90,format=webp/core-assets/products/iphone.avif'
    );
  });

  it('clamps OgaBassey CDN transformer dimensions and quality', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 9000, quality: 0 })).toBe(
      'https://cdn.ogabassey.com/image/width=3840,quality=1,format=webp/core-assets/products/iphone.avif'
    );
  });

  it('clamps high OgaBassey CDN transformer quality values', () => {
    const url = 'https://cdn.ogabassey.com/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 9000, quality: 999 })).toBe(
      'https://cdn.ogabassey.com/image/width=3840,quality=100,format=webp/core-assets/products/iphone.avif'
    );
  });

  it('returns non-OgaBassey https URLs directly without modification', () => {
    const url = 'https://example.com/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(url);
  });

  it('returns http URLs directly without modification', () => {
    const url = 'http://example.com/image.jpg';
    expect(imageLoader({ src: url, width: 400 })).toBe(url);
  });

  it('returns data URLs directly without modification', () => {
    const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    expect(imageLoader({ src: url, width: 64 })).toBe(url);
  });

  it('ignores width and quality for non-OgaBassey external URLs', () => {
    const url = 'https://cdn.example.com/img.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('leaves OgaBassey CDN URLs with query strings unchanged', () => {
    const url = 'https://cdn.ogabassey.com/img.avif?v=1';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('leaves already transformed OgaBassey CDN URLs unchanged', () => {
    const url =
      'https://cdn.ogabassey.com/image/width=229,quality=75,format=webp/core-assets/products/iphone.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('returns local public asset paths directly in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = imageLoader({ src: '/logo.png', width: 256 });
    expect(result).toBe('/logo.png');
  });

  it('returns local public asset paths directly in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = imageLoader({ src: '/img.png', width: 100, quality: 80 });
    expect(result).toBe('/img.png');
  });

  it('ignores custom quality for local public assets', () => {
    const result = imageLoader({ src: '/hero.jpg', width: 1920, quality: 90 });
    expect(result).toBe('/hero.jpg');
  });

  it('returns non-root relative paths directly', () => {
    const result = imageLoader({ src: 'images/logo.png', width: 100 });
    expect(result).toBe('images/logo.png');
  });

  it('returns empty src unchanged', () => {
    const result = imageLoader({ src: '', width: 100 });
    expect(result).toBe('');
  });

  it('returns protocol-relative URLs unchanged', () => {
    const result = imageLoader({
      src: '//cdn.example.com/img.jpg',
      width: 100,
    });
    expect(result).toBe('//cdn.example.com/img.jpg');
  });

  it('returns root-relative paths without encoding', () => {
    const result = imageLoader({
      src: '/path with spaces/img.png',
      width: 200,
    });
    expect(result).toBe('/path with spaces/img.png');
  });

  it('returns SVG public assets directly in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = imageLoader({ src: '/baci-logo.svg', width: 256 });
    expect(result).toBe('/baci-logo.svg');
  });
});
