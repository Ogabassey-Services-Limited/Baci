import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChainableMock,
  DELETE,
  MERCHANT_ID,
  makeParams,
  makeRequest,
  mockGetMerchantBlogCacheIdentifiers,
  mockHasPermission,
  mockRevalidateBlogPosts,
  mockSupabase,
  POST_ID,
  setupAuth,
} from './route.test-support';

function mockDeleteResult(result: { error: { message: string } | null }) {
  const deleteQuery = { eq: vi.fn() };
  deleteQuery.eq.mockReturnValueOnce(deleteQuery).mockResolvedValueOnce(result);
  mockSupabase.delete.mockReturnValue(deleteQuery);
  return deleteQuery;
}

describe('DELETE /api/merchant/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue({
      identifiers: ['test-store', 'ogabassey.com'],
      canonicalMerchantSlug: 'test-store',
    });
    mockSupabase.maybeSingle.mockResolvedValue({
      data: { slug: 'deleted-post', category: 'tech' },
      error: null,
    });
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing edit permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        { merchantId: MERCHANT_ID, role: 'owner' },
        'marketing',
        'edit'
      );
    });
  });

  describe('successful deletion', () => {
    it('deletes post and returns success', async () => {
      const deleteQuery = mockDeleteResult({ error: null });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'id', POST_ID);
      expect(deleteQuery.eq).toHaveBeenNthCalledWith(
        2,
        'merchant_id',
        MERCHANT_ID
      );
    });

    it('revalidates blog cache after deletion', async () => {
      mockDeleteResult({ error: null });

      await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );

      expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        identifiers: ['test-store', 'ogabassey.com'],
        canonicalMerchantSlug: 'test-store',
        listingCategories: ['tech'],
        postSlugs: ['deleted-post'],
      });
    });

    it('returns 500 when blog cache identifier setup fails before deletion', async () => {
      mockGetMerchantBlogCacheIdentifiers.mockRejectedValueOnce(
        new Error('cache setup failed')
      );

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
      expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns 404 rather than reporting deletion success for a missing tenant post', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Post not found' });
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('returns 500 when the pre-delete lookup fails', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Lookup failed' },
      });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to load post for deletion');
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it('returns 500 when database delete fails', async () => {
      mockDeleteResult({ error: { message: 'Delete failed' } });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to delete post');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.delete.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
