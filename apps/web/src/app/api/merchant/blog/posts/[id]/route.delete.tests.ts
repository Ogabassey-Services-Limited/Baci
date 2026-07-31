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
      // eq() call order: fetch existing post id -> fetch existing post merchant_id
      // -> delete post id -> delete post merchant_id
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));

      const res = await DELETE(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'DELETE'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', POST_ID);
      expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    });

    it('revalidates blog cache after deletion', async () => {
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => Promise.resolve({ error: null }));

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
      mockSupabase.eq
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() => mockSupabase)
        .mockImplementationOnce(() =>
          Promise.resolve({ error: { message: 'Delete failed' } })
        );

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
