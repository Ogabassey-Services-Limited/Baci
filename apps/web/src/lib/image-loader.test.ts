import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from '@/lib/image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('adds loader params to non-OgaBassey https URLs', () => {
    const url = 'https://example.com/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(`${url}?w=800&q=75`);
  });

  it('rewrites known external placeholder hosts to the local placeholder asset', () => {
    expect(
      imageLoader({
        src: 'https://placehold.co/400x400/f8fafc/94a3b8?text=No Image',
        width: 3840,
      })
    ).toBe('/placeholder.svg');
    expect(
      imageLoader({
        src: 'https://via.placeholder.com/600x600?text=No+Image',
        width: 600,
      })
    ).toBe('/placeholder.svg');
    expect(
      imageLoader({
        src: 'https://placehold.it/500x500?text=No+Image',
        width: 500,
      })
    ).toBe('/placeholder.svg');
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

  it('defaults unmigrated OgaBassey CDN callers to the jpeg fallback tier (never browser-facing format=auto)', () => {
    const result = imageLoader({
      src: 'https://cdn.ogabassey.com/core-assets/products/phone.avif',
      width: 750,
      quality: 75,
    });

    // PR-IMG-2c: the loader default is now the universally decodable fallback
    // format, so a plain <Image> on an OgaBassey CDN asset can never serve
    // non-AVIF browsers undecodable AVIF bytes off a shared format=auto key.
    expect(result).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=75,format=jpeg/core-assets/products/phone.avif'
    );
    expect(result).not.toContain('format=auto');
  });

  it('defaults an unmigrated OgaBassey png caller to the png fallback tier', () => {
    const result = imageLoader({
      src: 'https://cdn.ogabassey.com/core-assets/products/phone.png',
      width: 750,
      quality: 75,
    });

    expect(result).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=75,format=png/core-assets/products/phone.png'
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
