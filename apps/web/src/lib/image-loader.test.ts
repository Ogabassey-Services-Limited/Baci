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

  it('uses Next.js optimization for relative paths', () => {
    const result = imageLoader({ src: '/logo.png', width: 256 });
    expect(result).toBe('/_next/image?url=%2Flogo.png&w=256&q=75');
  });

  it('uses custom quality for relative paths when provided', () => {
    const result = imageLoader({ src: '/hero.jpg', width: 1920, quality: 90 });
    expect(result).toBe('/_next/image?url=%2Fhero.jpg&w=1920&q=90');
  });

  it('defaults quality to 75 for relative paths', () => {
    const result = imageLoader({ src: '/img.png', width: 100 });
    expect(result).toContain('q=75');
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
    expect(result).toBe(
      '/_next/image?url=%2Fpath%20with%20spaces%2Fimg.png&w=200&q=75'
    );
  });
});
