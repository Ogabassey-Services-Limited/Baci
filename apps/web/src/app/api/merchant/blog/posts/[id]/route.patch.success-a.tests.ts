import { describe, expect, it, vi } from 'vitest';
import {
  existingPost,
  registerPatchTestSetup,
  validUpdateData,
} from './patch.test-support';
import {
  makeParams,
  makeRequest,
  mockDispatchZohoBlogCampaign,
  mockGetMerchantBlogCacheIdentifiers,
  mockSubmitIndexNowUrls,
  mockSupabase,
  PATCH,
  POST_ID,
} from './route.test-support';

registerPatchTestSetup();

describe('PATCH /api/merchant/blog/posts/[id]', () => {
  describe('successful update', () => {
    it('updates post and returns updated data', async () => {
      const updatedPost = {
        ...existingPost,
        ...validUpdateData,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: updatedPost,
          error: null,
        });

      const res = await PATCH(
        makeRequest(
          `/api/merchant/blog/posts/${POST_ID}`,
          'PATCH',
          validUpdateData
        ),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.title).toBe('Updated Title');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('recalculates word count and reading time when content changes', async () => {
      const newContent =
        '<p>New content with many words to test reading time</p>';

      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, content: newContent },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          content: newContent,
          title: 'Updated Title', // Schema requires at least title or content
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify the update was called with calculated values
      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall).toHaveProperty('word_count');
      expect(updateCall).toHaveProperty('reading_time_minutes');
      expect(typeof updateCall.word_count).toBe('number');
      expect(typeof updateCall.reading_time_minutes).toBe('number');
    });

    it('lets Zoho dispatch recompute storefront context when publish revalidation fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('context lookup failed')
      );
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
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
      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledTimes(1);
      expect(mockDispatchZohoBlogCampaign.mock.calls[0][0]).toEqual({
        post: expect.objectContaining({ id: POST_ID, status: 'published' }),
        supabase: mockSupabase,
      });
      consoleErrorSpy.mockRestore();
    });

    it('sets published_at when changing status from draft to published', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
          error: null,
        });

      const res = await PATCH(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'PATCH', {
          status: 'published',
          title: 'Updated Title', // Schema requires at least title or content
        }),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalled();

      // Verify the update was called with published_at
      const updateCall = mockSupabase.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(updateCall).toHaveProperty('published_at');
      expect(typeof updateCall.published_at).toBe('string');
      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledTimes(1);
      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith({
        context: {
          identifiers: ['test-store', 'ogabassey.com'],
          canonicalMerchantSlug: 'test-store',
        },
        post: expect.objectContaining({
          id: POST_ID,
          status: 'published',
        }),
        supabase: mockSupabase,
      });
      expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith({
        host: 'ogabassey.com',
        urls: ['https://ogabassey.com/blog/original-slug'],
      });
    });

    it('keeps publishing successful when IndexNow submission fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const indexNowError = new Error('IndexNow unavailable');
      mockSubmitIndexNowUrls.mockRejectedValueOnce(indexNowError);
      mockSupabase.single
        .mockResolvedValueOnce({
          data: existingPost,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...existingPost, status: 'published' },
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
      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'IndexNow blog submit failed',
          indexNowError
        );
      });
      consoleErrorSpy.mockRestore();
    });
  });
});
