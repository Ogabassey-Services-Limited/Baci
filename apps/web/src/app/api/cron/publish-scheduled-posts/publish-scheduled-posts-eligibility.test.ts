import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';
import {
  configurePublishFlow,
  createCronRequest,
  createScheduledPost,
  managedFeaturedImageUrl,
  managedLandscapeVariantUrl,
  merchantId,
  mockPrewarmOgabasseyImageTransforms,
  mockRevalidateBlogPosts,
  mockSupabase,
  POST,
  resetCronRouteMocks,
} from './route.test-support';

describe('scheduled-post publishing Discover readiness', () => {
  beforeEach(resetCronRouteMocks);
  afterEach(() => vi.unstubAllEnvs());

  it('skips invalid rows when Discover validation is enabled', async () => {
    const readyPost = createScheduledPost({
      featured_image_height: 675,
      featured_image_url: managedFeaturedImageUrl,
      featured_image_variants: { landscape_16x9: managedLandscapeVariantUrl },
      featured_image_width: 1200,
      id: 'post-ready',
      merchant_id: merchantId,
    });
    const invalidPost = createScheduledPost({
      id: 'post-invalid',
      merchant_id: merchantId,
    });
    configurePublishFlow([readyPost, invalidPost], {
      featureSettings: [
        {
          merchant_id: merchantId,
          blog_discover_image_validation_enabled: true,
        },
      ],
    });

    const response = await POST(createCronRequest());
    const json = await response.json();
    expect(json.published).toEqual(['post-ready']);
    expect(json.skipped).toEqual([
      expect.objectContaining({
        id: 'post-invalid',
        code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
      }),
    ]);
    expect(mockSupabase.in).toHaveBeenLastCalledWith('id', ['post-ready']);
  });

  it('warns but publishes invalid rows when Discover validation is disabled', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    configurePublishFlow([createScheduledPost({ id: 'post-invalid' })]);

    try {
      const response = await POST(createCronRequest());
      const json = await response.json();
      expect(json.published).toEqual(['post-invalid']);
      expect(json.warnings).toEqual([
        expect.objectContaining({
          code: 'BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY',
        }),
      ]);
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('avoids mutation when no scheduled row is eligible', async () => {
    configurePublishFlow([createScheduledPost({ id: 'post-invalid' })], {
      featureSettings: [
        {
          merchant_id: 'merchant-1',
          blog_discover_image_validation_enabled: true,
        },
      ],
    });
    const response = await POST(createCronRequest());
    expect(response.status).toBe(200);
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });

  it('prewarms managed featured images only', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    configurePublishFlow([
      createScheduledPost({
        featured_image_height: 675,
        featured_image_url: managedFeaturedImageUrl,
        featured_image_variants: { landscape_16x9: managedLandscapeVariantUrl },
        featured_image_width: 1200,
        merchant_id: merchantId,
      }),
      createScheduledPost({ id: 'post-imageless', merchant_id: merchantId }),
    ]);

    try {
      const response = await POST(createCronRequest());
      expect(response.status).toBe(200);
      expect(mockPrewarmOgabasseyImageTransforms).toHaveBeenCalledWith(
        [managedFeaturedImageUrl],
        { widthQualityPairs: BLOG_IMAGE_WIDTH_QUALITY_PAIRS }
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });
});
