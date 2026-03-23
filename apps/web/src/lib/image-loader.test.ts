import { describe, expect, it } from 'vitest';
import imageLoader from './image-loader';

describe('imageLoader', () => {
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

  it('returns local public asset paths directly', () => {
    const result = imageLoader({ src: '/logo.png', width: 256 });
    expect(result).toBe('/logo.png');
  });

  it('ignores custom quality for local public assets', () => {
    const result = imageLoader({ src: '/hero.jpg', width: 1920, quality: 90 });
    expect(result).toBe('/hero.jpg');
  });

  it('still optimizes non-root relative paths', () => {
    const result = imageLoader({ src: 'images/logo.png', width: 100 });
    expect(result).toContain('/_next/image?url=images%2Flogo.png&w=100&q=75');
  });

  it('returns root-relative assets directly regardless of quality defaults', () => {
    const result = imageLoader({ src: '/img.png', width: 100 });
    expect(result).toBe('/img.png');
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

  it('encodes special characters in relative paths', () => {
    const result = imageLoader({
      src: '/path with spaces/img.png',
      width: 200,
    });
    expect(result).toBe('/path with spaces/img.png');
  });
});
