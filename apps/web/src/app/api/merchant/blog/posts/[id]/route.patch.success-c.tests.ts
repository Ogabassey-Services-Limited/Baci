import { describe, expect, it } from 'vitest';
import {
  existingPost,
  registerPatchTestSetup,
  validUpdateData,
} from './patch.test-support';
import {
  MERCHANT_ID,
  makeParams,
  makeRequest,
  managedFeaturedImageUrl,
  managedLandscapeVariantUrl,
  mockDispatchZohoBlogCampaign,
  mockGetMerchantBlogCacheIdentifiers,
  mockInvokeEmbedding,
  mockRevalidateBlogPosts,
  mockSupabase,
  PATCH,
  POST_ID,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
  describe('successful update', () => {
    it('persists valid Discover metadata when publishing', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
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
          status: 'published',
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeVariantUrl,
          },
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          featured_image_url: managedFeaturedImageUrl,
          featured_image_width: 1200,
          featured_image_height: 675,
          featured_image_variants: {
            landscape_16x9: managedLandscapeVariantUrl,
          },
        })
      );
    });

    it('does not override published_at when already published', async () => {
      const publishedPost = {
        ...existingPost,
        status: 'published',
        published_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: publishedPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: publishedPost,
          error: null,
        });

      await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          title: 'Updated Title',
        }),
        makeParams(POST_ID)
      );

      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall.published_at).toBeUndefined();
      expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
    });

    it('returns only the explicit post projection after an update', async () => {
      await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(mockSupabase.select).toHaveBeenCalledWith(
        'id, merchant_id, title, slug, content, excerpt, category, featured_image_url, status, published_at'
      );
    });

    it('triggers embedding regeneration through the authorized request client when content changes', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: validUpdateData.content },
          error: null,
        });

      await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(mockInvokeEmbedding).toHaveBeenCalledWith('generate-embedding', {
        body: expect.objectContaining({ id: POST_ID, type: 'blog' }),
      });
    });

    it('revalidates blog cache after update', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ ...existingPost, slug: 'updated-slug' }],
        error: null,
      });

      await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: [],
        postSlugs: ['original-slug', 'updated-slug'],
      });
    });

    it('continues update when blog cache identifier setup fails after update', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: validUpdateData.content },
          error: null,
        });
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('cache setup failed')
      );

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      await res.json();

      expect(res.status).toBe(200);
      expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
    });
  });
});
