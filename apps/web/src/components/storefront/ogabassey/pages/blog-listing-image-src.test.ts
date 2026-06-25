import { describe, expect, it } from 'vitest';
import { getBlogListingImageSrc } from './blog-listing-image-src';

describe('getBlogListingImageSrc', () => {
  it('keeps absolute and safe local blog image URLs renderable', () => {
    expect(getBlogListingImageSrc(' https://cdn.example.com/hero.avif ')).toBe(
      'https://cdn.example.com/hero.avif'
    );
    expect(getBlogListingImageSrc('/uploads/blog/hero.png')).toBe(
      '/uploads/blog/hero.png'
    );
  });

  it('falls back for empty, protocol-relative, or unsafe URLs', () => {
    expect(getBlogListingImageSrc('')).toBe('/placeholder.png');
    expect(getBlogListingImageSrc('//cdn.example.com/hero.png')).toBe(
      '/placeholder.png'
    );
    expect(getBlogListingImageSrc('javascript:alert(1)')).toBe(
      '/placeholder.png'
    );
  });
});
