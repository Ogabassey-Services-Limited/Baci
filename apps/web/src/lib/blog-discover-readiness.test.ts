import { describe, expect, it } from 'vitest';
import {
  classifyBlogDiscoverImageReadiness,
  validateBlogDiscoverImageReadiness,
  validateBlogImageVariantIntegrity,
} from '@/lib/blog-discover-readiness';
import { PLATFORM_BLOG_MEDIA_PREFIX } from '@/lib/blog-managed-storage-paths';

const merchantId = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const managedOriginalUrl = `https://cdn.example.com/storage/v1/object/public/media/${merchantId}/blog/cover.png`;
const managedLandscapeUrl = `https://cdn.example.com/storage/v1/object/public/media/${merchantId}/blog/upload-1/landscape_16x9.webp`;
const managedPlatformOriginalUrl = `https://cdn.example.com/storage/v1/object/public/media/${PLATFORM_BLOG_MEDIA_PREFIX}/cover.png`;
const managedPlatformLandscapeUrl = `https://cdn.example.com/storage/v1/object/public/media/${PLATFORM_BLOG_MEDIA_PREFIX}/upload-1/landscape_16x9.webp`;

describe('validateBlogDiscoverImageReadiness', () => {
  it('returns ready for a managed image with valid dimensions and landscape variant', () => {
    expect(
      validateBlogDiscoverImageReadiness(
        {
          featured_image_url: managedOriginalUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeUrl,
          },
        },
        merchantId
      )
    ).toEqual({ ready: true });
  });

  it('rejects published readiness when the featured image is missing', () => {
    expect(
      validateBlogDiscoverImageReadiness(
        {
          featured_image_url: null,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
        merchantId
      )
    ).toMatchObject({
      ready: false,
      code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
    });
  });

  it('rejects unmanaged original image URLs without fetching them', () => {
    expect(
      validateBlogDiscoverImageReadiness(
        {
          featured_image_url: 'https://example.com/external.jpg',
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeUrl,
          },
        },
        merchantId
      )
    ).toMatchObject({
      ready: false,
      code: 'BLOG_FEATURED_IMAGE_NOT_MANAGED',
    });
  });

  it('requires a same-merchant managed landscape variant', () => {
    expect(
      validateBlogDiscoverImageReadiness(
        {
          featured_image_url: managedOriginalUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {},
        },
        merchantId
      )
    ).toMatchObject({
      ready: false,
      code: 'BLOG_FEATURED_IMAGE_VARIANT_MISSING',
    });
  });

  it('supports platform scope validation for platform-managed media paths', () => {
    expect(
      validateBlogDiscoverImageReadiness(
        {
          featured_image_url: managedPlatformOriginalUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedPlatformLandscapeUrl,
          },
        },
        { kind: 'platform' }
      )
    ).toEqual({ ready: true });
  });
});

describe('validateBlogImageVariantIntegrity', () => {
  it('rejects external variant URLs even for non-published drafts', () => {
    expect(
      validateBlogImageVariantIntegrity(
        {
          featured_image_variants: {
            landscape_16x9: 'https://example.com/variant.webp',
          },
        },
        merchantId
      )
    ).toMatchObject({
      ready: false,
      code: 'BLOG_FEATURED_IMAGE_VARIANT_NOT_MANAGED',
    });
  });
});

describe('classifyBlogDiscoverImageReadiness', () => {
  it('classifies legacy published rows with an image but missing metadata', () => {
    expect(
      classifyBlogDiscoverImageReadiness(
        {
          status: 'published',
          featured_image_url: managedOriginalUrl,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
        merchantId
      )
    ).toBe('legacy_missing_metadata');
  });

  it('does not flag draft rows', () => {
    expect(
      classifyBlogDiscoverImageReadiness(
        {
          status: 'draft',
          featured_image_url: null,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        },
        merchantId
      )
    ).toBe('ready');
  });
});
