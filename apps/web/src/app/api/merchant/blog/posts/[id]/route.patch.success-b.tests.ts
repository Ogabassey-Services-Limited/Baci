import { describe, expect, it } from 'vitest';
import { existingPost, registerPatchTestSetup } from './patch.test-support';
import {
  makeParams,
  makeRequest,
  managedFeaturedImageUrl,
  managedLandscapeVariantUrl,
  mockSupabase,
  PATCH,
  POST_ID,
  replacementManagedFeaturedImageUrl,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
  describe('successful update', () => {
    it('preserves explicit published_at when publishing a draft', async () => {
      const providedPublishedAt = '2026-01-01T00:00:00Z';

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...existingPost,
            status: 'published',
            published_at: providedPublishedAt,
          },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title',
          published_at: providedPublishedAt,
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall.published_at).toBe(providedPublishedAt);
    });

    it('allows unrelated edits to legacy published posts with unchanged image metadata', async () => {
      const legacyPublishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2026-01-01T00:00:00Z',
        featured_image_url: managedFeaturedImageUrl,
        featured_image_width: null,
        featured_image_height: null,
        featured_image_variants: {},
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: legacyPublishedPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...legacyPublishedPost, title: 'Updated Title' },
          error: null,
        });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: true,
        },
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Title' })
      );
    });

    it('clears stale image metadata when the featured image URL changes without replacement metadata', async () => {
      const postWithDiscoverImage = {
        ...existingPost,
        featured_image_url: managedFeaturedImageUrl,
        featured_image_width: 1200,
        featured_image_height: 675,
        featured_image_variants: {
          landscape_16x9: managedLandscapeVariantUrl,
        },
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: postWithDiscoverImage,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...postWithDiscoverImage,
            featured_image_url: replacementManagedFeaturedImageUrl,
            featured_image_width: null,
            featured_image_height: null,
            featured_image_variants: {},
          },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
          featured_image_url: replacementManagedFeaturedImageUrl,
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          featured_image_url: replacementManagedFeaturedImageUrl,
          featured_image_width: null,
          featured_image_height: null,
          featured_image_variants: {},
        })
      );
    });

    it('treats explicit null image metadata as cleared during Discover readiness checks', async () => {
      const publishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2026-01-01T00:00:00Z',
        featured_image_url: managedFeaturedImageUrl,
        featured_image_width: 1200,
        featured_image_height: 675,
        featured_image_variants: {
          landscape_16x9: managedLandscapeVariantUrl,
        },
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: publishedPost,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          blog_enabled: true,
          blog_discover_image_validation_enabled: true,
        },
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
          featured_image_width: null,
        }),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.code).toBe('BLOG_FEATURED_IMAGE_NOT_DISCOVER_READY');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });
});
