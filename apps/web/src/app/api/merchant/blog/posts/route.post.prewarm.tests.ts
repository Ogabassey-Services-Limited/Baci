import { describe, expect, it } from 'vitest';
import { registerPostTestSetup, validPostData } from './post.test-support';
import {
  makeRequest,
  managedFeaturedImageUrl,
  managedLandscapeVariantUrl,
  mockSchedulePrewarmBlogImageTransforms,
  mockSupabase,
  POST,
} from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts', () => {
  describe('CDN image-transform prewarm', () => {
    it('schedules a blog image prewarm when the created post is published', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      mockSupabase.select.mockImplementation((fields: string) => {
        if (fields === 'business_name, slug') {
          mockSupabase.single.mockResolvedValueOnce({
            data: { business_name: 'Test Store', slug: 'test-store' },
            error: null,
          });
        } else if (
          fields === 'blog_enabled' ||
          fields === 'blog_enabled, blog_discover_image_validation_enabled'
        ) {
          mockSupabase.single.mockResolvedValueOnce({
            data: {
              blog_enabled: true,
              blog_discover_image_validation_enabled: false,
            },
            error: null,
          });
        } else {
          mockSupabase.single.mockResolvedValueOnce({
            data: {
              id: '1',
              slug: 'new-blog-post',
              status: 'published',
              featured_image_url: managedFeaturedImageUrl,
            },
            error: null,
          });
        }
        return mockSupabase;
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: {
            ...validPostData,
            status: 'published',
            featured_image_url: managedFeaturedImageUrl,
            featured_image_width: 1200,
            featured_image_height: 675,
            featured_image_variants: {
              landscape_16x9: managedLandscapeVariantUrl,
            },
          },
        })
      );

      expect(res.status).toBe(201);
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledTimes(1);
      expect(mockSchedulePrewarmBlogImageTransforms).toHaveBeenCalledWith([
        managedFeaturedImageUrl,
      ]);
    });

    it('does not schedule a blog image prewarm when the created post is a draft', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );

      expect(res.status).toBe(201);
      expect(mockSchedulePrewarmBlogImageTransforms).not.toHaveBeenCalled();
    });
  });
});
