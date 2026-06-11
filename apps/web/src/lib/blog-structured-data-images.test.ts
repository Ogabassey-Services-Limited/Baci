import { describe, expect, it } from 'vitest';
import {
  getBlogStructuredDataImages,
  getBlogStructuredDataImageUrls,
} from '@/lib/blog-structured-data-images';

const ORIGINAL_URL =
  'https://cdn.ogabassey.com/media/merchant-1/blog/original.png';
const LANDSCAPE_URL =
  'https://cdn.ogabassey.com/media/merchant-1/blog/upload/landscape_16x9.webp';
const STANDARD_URL =
  'https://cdn.ogabassey.com/media/merchant-1/blog/upload/standard_4x3.webp';
const SQUARE_URL =
  'https://cdn.ogabassey.com/media/merchant-1/blog/upload/square_1x1.webp';

describe('getBlogStructuredDataImageUrls', () => {
  it('returns persisted Discover image variants in Google-recommended aspect order', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
        featured_image_variants: {
          square_1x1: SQUARE_URL,
          landscape_16x9: LANDSCAPE_URL,
          standard_4x3: STANDARD_URL,
        },
      })
    ).toEqual([LANDSCAPE_URL, STANDARD_URL, SQUARE_URL]);
  });

  it('dedupes duplicate variant URLs', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
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
          standard_4x3: STANDARD_URL,
          landscape_16x9: LANDSCAPE_URL,
        },
      })
    ).toEqual([LANDSCAPE_URL, STANDARD_URL]);
  });

  it('falls back to the featured original only when no variants are persisted', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
        featured_image_variants: {},
      })
    ).toEqual([ORIGINAL_URL]);
  });

  it('returns original URL when featured_image_variants is null or missing', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
        featured_image_variants: null,
      })
    ).toEqual([ORIGINAL_URL]);

    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
      })
    ).toEqual([ORIGINAL_URL]);
  });

  it('returns original URL when featured_image_variants is malformed', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ORIGINAL_URL,
        featured_image_variants: 'not-an-object' as unknown as Record<
          string,
          unknown
        >,
      })
    ).toEqual([ORIGINAL_URL]);
  });

  it('returns no image URLs for nullish or imageless input', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: null,
        featured_image_variants: {},
      })
    ).toEqual([]);
    expect(getBlogStructuredDataImageUrls(null)).toEqual([]);
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
          square_1x1: SQUARE_URL,
        },
      })
    ).toEqual([SQUARE_URL]);
  });

  it('trims valid URL strings before returning them', () => {
    expect(
      getBlogStructuredDataImageUrls({
        featured_image_url: ` ${ORIGINAL_URL} `,
        featured_image_variants: {
          landscape_16x9: ` ${LANDSCAPE_URL} `,
        },
      })
    ).toEqual([LANDSCAPE_URL]);
  });
});

describe('getBlogStructuredDataImages', () => {
  it('returns no ImageObjects for nullish input', () => {
    expect(getBlogStructuredDataImages(null)).toEqual([]);
    expect(getBlogStructuredDataImages(undefined)).toEqual([]);
  });

  it('returns ImageObjects with inferred variant dimensions for BlogPosting JSON-LD', () => {
    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: 1536,
        featured_image_height: 864,
        featured_image_variants: {
          square_1x1: SQUARE_URL,
          landscape_16x9: LANDSCAPE_URL,
          standard_4x3: STANDARD_URL,
        },
      })
    ).toEqual([
      {
        '@type': 'ImageObject',
        url: LANDSCAPE_URL,
        width: 1200,
        height: 675,
      },
      {
        '@type': 'ImageObject',
        url: STANDARD_URL,
        width: 1200,
        height: 900,
      },
      {
        '@type': 'ImageObject',
        url: SQUARE_URL,
        width: 1200,
        height: 1200,
      },
    ]);
  });

  it('dedupes duplicate variant URLs and keeps the first variant dimensions', () => {
    const sharedUrl =
      'https://cdn.ogabassey.com/media/merchant-1/blog/upload/shared.webp';

    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_variants: {
          landscape_16x9: sharedUrl,
          standard_4x3: sharedUrl,
        },
      })
    ).toEqual([
      {
        '@type': 'ImageObject',
        url: sharedUrl,
        width: 1200,
        height: 675,
      },
    ]);
  });

  it('falls back to original ImageObject dimensions from persisted DB fields', () => {
    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: 1536,
        featured_image_height: 864,
      })
    ).toEqual([
      {
        '@type': 'ImageObject',
        url: ORIGINAL_URL,
        width: 1536,
        height: 864,
      },
    ]);
  });

  it('omits original dimensions unless both persisted dimensions are valid positive integers', () => {
    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: 1536,
        featured_image_height: null,
      })
    ).toEqual([{ '@type': 'ImageObject', url: ORIGINAL_URL }]);

    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: 0,
        featured_image_height: 864,
      })
    ).toEqual([{ '@type': 'ImageObject', url: ORIGINAL_URL }]);

    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: -1536,
        featured_image_height: 864.5,
      })
    ).toEqual([{ '@type': 'ImageObject', url: ORIGINAL_URL }]);
  });

  it('ignores malformed variants and invalid original URLs', () => {
    expect(
      getBlogStructuredDataImages({
        featured_image_url: 'notaurl',
        featured_image_width: 1536,
        featured_image_height: 864,
        featured_image_variants: 'not-an-object' as unknown as Record<
          string,
          unknown
        >,
      })
    ).toEqual([]);
  });

  it('ignores invalid variant URLs before falling back to the original image', () => {
    expect(
      getBlogStructuredDataImages({
        featured_image_url: ORIGINAL_URL,
        featured_image_width: 1536,
        featured_image_height: 864,
        featured_image_variants: {
          landscape_16x9: ' ',
          standard_4x3: 'ftp://cdn.ogabassey.com/media/bad.webp',
        },
      })
    ).toEqual([
      {
        '@type': 'ImageObject',
        url: ORIGINAL_URL,
        width: 1536,
        height: 864,
      },
    ]);
  });
});
