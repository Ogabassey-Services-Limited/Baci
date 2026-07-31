import { describe, expect, it } from 'vitest';
import { existingPost, registerPatchTestSetup } from './patch.test-support';
import {
  makeParams,
  makeRequest,
  managedFeaturedImageUrl,
  mockSchedulePrewarmBlogImageTransforms,
  mockSupabase,
  PATCH,
  POST_ID,
  replacementManagedFeaturedImageUrl,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
  describe('CDN image-transform prewarm', () => {
    it('schedules a blog image prewarm when publishing a draft', async () => {
      const draftWithImage = {
        ...existingPost,
        featured_image_url: managedFeaturedImageUrl,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: draftWithImage,
        error: null,
      });
      mockSupabase.rpc.mockResolvedValue({
        data: [{ ...draftWithImage, status: 'published' }],
        error: null,
      });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledTimes(1);
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledWith([
        managedFeaturedImageUrl,
      ]);
    });

    it('schedules a blog image prewarm when the featured image changes on a published post', async () => {
      const publishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2026-01-01T00:00:00Z',
        featured_image_url: managedFeaturedImageUrl,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: publishedPost,
        error: null,
      });
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            ...publishedPost,
            featured_image_url: replacementManagedFeaturedImageUrl,
          },
        ],
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
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledTimes(1);
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledWith([
        replacementManagedFeaturedImageUrl,
      ]);
    });

    it('does not schedule a blog image prewarm when the image is unchanged and the post is not being published', async () => {
      const publishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2026-01-01T00:00:00Z',
        featured_image_url: managedFeaturedImageUrl,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: publishedPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...publishedPost, title: 'Updated Title' },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSchedulePrewarmBlogImageTransforms).not.toHaveBeenCalled();
    });
  });
});
