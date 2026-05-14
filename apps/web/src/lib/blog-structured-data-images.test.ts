import { describe, expect, it } from 'vitest';
import { getBlogStructuredDataImageUrls } from '@/lib/blog-structured-data-images';

describe('getBlogStructuredDataImageUrls', () => {
  it('returns persisted Discover image variants in Google-recommended aspect order', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: {
          square_1x1:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/square_1x1.webp',
          landscape_16x9:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp',
          standard_4x3:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/standard_4x3.webp',
        },
      })
    ).toEqual([
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp',
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/standard_4x3.webp',
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/square_1x1.webp',
    ]);
  });

  it('dedupes duplicate variant URLs', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: {
          standard_4x3:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/shared.webp',
          landscape_16x9:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/shared.webp',
        },
      })
    ).toEqual([
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/shared.webp',
    ]);
  });

  it('orders partial variant sets when featured_image_url is null', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: null,
        featured_image_variants: {
          standard_4x3:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/standard_4x3.webp',
          landscape_16x9:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp',
        },
      })
    ).toEqual([
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp',
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/standard_4x3.webp',
    ]);
  });

  it('falls back to the featured original only when no variants are persisted', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: {},
      })
    ).toEqual(['https://cdn.ogabassey.com/media/merchant-1/blog/original.png']);
  });

  it('returns original URL when featured_image_variants is null', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: null,
      })
    ).toEqual(['https://cdn.ogabassey.com/media/merchant-1/blog/original.png']);
  });

  it('returns original URL when featured_image_variants is missing', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
      })
    ).toEqual(['https://cdn.ogabassey.com/media/merchant-1/blog/original.png']);
  });

  it('returns original URL when featured_image_variants is malformed', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url:
          'https://cdn.ogabassey.com/media/merchant-1/blog/original.png',
        featured_image_variants: 'not-an-object' as unknown as Record<
          string,
          unknown
        >,
      })
    ).toEqual(['https://cdn.ogabassey.com/media/merchant-1/blog/original.png']);
  });

  it('returns no image URLs for an imageless post', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: null,
        featured_image_variants: {},
      })
    ).toEqual([]);
  });

  it('returns no image URLs for null input', () => {
    expect(getBlogStructuredDataImageUrls(null)).toEqual([]);
  });

  it('returns no image URLs for undefined input', () => {
    expect(getBlogStructuredDataImageUrls(undefined)).toEqual([]);
  });

  it('ignores empty, invalid, and non-string variant URL values', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: 'notaurl',
        featured_image_variants: {
          landscape_16x9: ' ',
          standard_4x3: 'ftp://cdn.ogabassey.com/media/bad.webp',
          extra_value: 123,
          square_1x1:
            'https://cdn.ogabassey.com/media/merchant-1/blog/upload/square_1x1.webp',
        },
      })
    ).toEqual([
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/square_1x1.webp',
    ]);
  });

  it('trims valid URL strings before returning them', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ' https://cdn.ogabassey.com/media/original.png ',
        featured_image_variants: {
          landscape_16x9:
            ' https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp ',
        },
      })
    ).toEqual([
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp',
    ]);
  });
});
