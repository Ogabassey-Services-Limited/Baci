import { describe, expect, it } from 'vitest';
import {
  getFeaturedImagePreviewUrl,
  INITIAL_FORM_DATA,
  normalizeFeaturedImageVariantMap,
  normalizeFeaturedImageVariantPaths,
  normalizePostFormData,
  withFeaturedImageDefaults,
} from './edit-blog-form-data';

describe('edit blog form data', () => {
  it('keeps only supported non-empty featured image variants', () => {
    expect(
      normalizeFeaturedImageVariantMap({
        landscape_16x9: 'https://cdn.example.com/landscape.webp',
        square_1x1: '',
        unsupported: 'https://cdn.example.com/unsupported.webp',
      })
    ).toEqual({
      landscape_16x9: 'https://cdn.example.com/landscape.webp',
    });
  });

  it('keeps only supported non-empty managed variant paths', () => {
    expect(
      normalizeFeaturedImageVariantPaths({
        landscape_16x9: 'merchant/blog/image/landscape_16x9.webp',
        square_1x1: null,
        unsupported: 'merchant/blog/image/unsupported.webp',
      })
    ).toEqual({
      landscape_16x9: 'merchant/blog/image/landscape_16x9.webp',
    });
  });

  it('backfills missing legacy image metadata without changing other fields', () => {
    const legacyData = {
      ...INITIAL_FORM_DATA,
      featured_image_height: undefined,
      featured_image_variants: undefined,
      featured_image_width: undefined,
      title: 'Legacy post',
    } as unknown as typeof INITIAL_FORM_DATA;

    expect(withFeaturedImageDefaults(legacyData)).toEqual(
      expect.objectContaining({
        featured_image_height: null,
        featured_image_variants: {},
        featured_image_width: null,
        title: 'Legacy post',
      })
    );
  });

  it('normalizes a valid publication timestamp to ISO form', () => {
    expect(
      normalizePostFormData({
        ...INITIAL_FORM_DATA,
        published_at: '2026-08-01T12:30:00+01:00',
      }).published_at
    ).toBe('2026-08-01T11:30:00.000Z');
  });

  it('prefers the landscape variant for previews and falls back to the original', () => {
    expect(
      getFeaturedImagePreviewUrl({
        ...INITIAL_FORM_DATA,
        featured_image_url: 'https://cdn.example.com/original.png',
        featured_image_variants: {
          landscape_16x9: 'https://cdn.example.com/landscape.webp',
        },
      })
    ).toBe('https://cdn.example.com/landscape.webp');
    expect(
      getFeaturedImagePreviewUrl({
        ...INITIAL_FORM_DATA,
        featured_image_url: 'https://cdn.example.com/original.png',
      })
    ).toBe('https://cdn.example.com/original.png');
  });
});
