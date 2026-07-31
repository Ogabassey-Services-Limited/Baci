import { describe, expect, it, vi } from 'vitest';
import {
  mockPostCreationSelectSequence,
  registerPostTestSetup,
  validPostData,
} from './post.test-support';
import {
  makeRequest,
  mockDispatchZohoBlogCampaign,
  mockGetMerchantBlogCacheIdentifiers,
  mockSubmitIndexNowUrls,
  mockSupabase,
  POST,
} from './route.test-support';

registerPostTestSetup();

describe('POST /api/merchant/blog/posts', () => {
  describe('duplicate slug detection', () => {
    it('returns 409 when slug already exists', async () => {
      mockPostCreationSelectSequence({
        existingPost: {
          data: { id: 'existing-post-id' },
          error: null,
        },
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe('A post with this slug already exists');
    });
  });

  describe('successful post creation', () => {
    it('creates post with status 201 and returns post data', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const res = await POST(
        makeRequest('/api/merchant/blog/posts', { body: validPostData })
      );
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe('1'); // From mock default
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(mockDispatchZohoBlogCampaign).not.toHaveBeenCalled();
    });

    it('sets published_at when status is published', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-31T18:30:00.000Z'));

      const publishedData = { ...validPostData, status: 'published' };

      try {
        await POST(
          makeRequest('/api/merchant/blog/posts', { body: publishedData })
        );

        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            published_at: '2026-07-31T18:30:00.000Z',
          })
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it('lets Zoho dispatch recompute storefront context when revalidation lookup fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('context lookup failed')
      );
      mockPostCreationSelectSequence({
        createdPost: {
          data: { id: '1', slug: 'new-blog-post', status: 'published' },
          error: null,
        },
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: { ...validPostData, status: 'published' },
        })
      );

      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledTimes(1);
      expect(mockDispatchZohoBlogCampaign.mock.calls[0][0]).toEqual({
        post: expect.objectContaining({ id: '1', status: 'published' }),
        supabase: mockSupabase,
      });
      consoleErrorSpy.mockRestore();
    });

    it('triggers post-publication side effects for published posts', async () => {
      mockPostCreationSelectSequence({
        createdPost: {
          data: { id: '1', slug: 'new-blog-post', status: 'published' },
          error: null,
        },
      });

      await POST(
        makeRequest('/api/merchant/blog/posts', {
          body: { ...validPostData, status: 'published' },
        })
      );

      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledTimes(1);
      expect(mockDispatchZohoBlogCampaign).toHaveBeenCalledWith({
        context: {
          identifiers: ['test-store', 'ogabassey.com'],
          canonicalMerchantSlug: 'test-store',
        },
        post: expect.objectContaining({ id: '1', status: 'published' }),
        supabase: mockSupabase,
      });
      expect(mockSubmitIndexNowUrls).toHaveBeenCalledWith({
        host: 'ogabassey.com',
        urls: ['https://ogabassey.com/blog/new-blog-post'],
      });
    });
  });
});
