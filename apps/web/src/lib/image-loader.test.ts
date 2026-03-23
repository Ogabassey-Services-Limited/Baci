import { afterEach, describe, expect, it, vi } from 'vitest';
import imageLoader from './image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns https URLs directly without modification', () => {
    const url = 'https://cdn.ogabassey.com/products/iphone.avif';
    expect(imageLoader({ src: url, width: 800 })).toBe(url);
  });

  it('returns http URLs directly without modification', () => {
    const url = 'http://example.com/image.jpg';
    expect(imageLoader({ src: url, width: 400 })).toBe(url);
  });

  it('ignores width and quality for external URLs', () => {
    const url = 'https://cdn.ogabassey.com/img.avif';
    expect(imageLoader({ src: url, width: 1200, quality: 90 })).toBe(url);
  });

  it('returns local public asset paths directly in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = imageLoader({ src: '/logo.png', width: 256 });
    expect(result).toBe('/logo.png');
  });

  it('ignores custom quality for local public assets in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = imageLoader({ src: '/hero.jpg', width: 1920, quality: 90 });
    expect(result).toBe('/hero.jpg');
  });

  it('optimizes local public assets outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const result = imageLoader({ src: '/img.png', width: 100, quality: 80 });
    expect(result).toBe('/_next/image?url=%2Fimg.png&w=100&q=80');
  });

  it('still optimizes non-root relative paths', () => {
    const result = imageLoader({ src: 'images/logo.png', width: 100 });
    expect(result).toBe('/_next/image?url=images%2Flogo.png&w=100&q=75');
  });

  it('treats empty src as a relative path', () => {
    const result = imageLoader({ src: '', width: 100 });
    expect(result).toBe('/_next/image?url=&w=100&q=75');
  });

  it('treats protocol-relative URLs as relative paths', () => {
    const result = imageLoader({
      src: '//cdn.example.com/img.jpg',
      width: 100,
    });
    expect(result).toBe(
      '/_next/image?url=%2F%2Fcdn.example.com%2Fimg.jpg&w=100&q=75'
    );
  });

  it('returns root-relative paths without encoding in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const result = imageLoader({
      src: '/path with spaces/img.png',
      width: 200,
    });
    expect(result).toBe('/path with spaces/img.png');
  });
});
