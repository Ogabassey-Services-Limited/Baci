import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChainableMock,
  GET,
  MERCHANT_ID,
  makeParams,
  makeRequest,
  mockAuthenticateApiRequest,
  mockDispatchZohoBlogCampaign,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  mockSupabase,
  POST_ID,
  setupAuth,
  USER_ID,
} from './route.test-support';

describe('GET /api/merchant/blog/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatchZohoBlogCampaign.mockResolvedValue({
      postId: 'post-1',
      reason: 'Zoho Campaigns disabled',
      status: 'skipped',
    });

    // Recreate chainable mock for each test
    const freshMock = createChainableMock();
    Object.assign(mockSupabase, freshMock);

    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
  });

  describe('authentication', () => {
    it('authenticates before awaiting route params', async () => {
      let resolveParams: ((value: { id: string }) => void) | undefined;
      const response = GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        {
          params: new Promise<{ id: string }>((resolve) => {
            resolveParams = resolve;
          }),
        }
      );

      await vi.waitFor(() =>
        expect(mockAuthenticateApiRequest).toHaveBeenCalledOnce()
      );
      resolveParams?.({ id: POST_ID });
      await response;
    });

    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  it('authorizes the requested merchant before fetching a post', async () => {
    await GET(
      makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
      makeParams(POST_ID)
    );

    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      USER_ID,
      { requestedMerchantId: MERCHANT_ID }
    );
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing view permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toBe('Permission denied');
      expect(mockHasPermission).toHaveBeenCalledWith(
        { merchantId: MERCHANT_ID, role: 'owner' },
        'marketing',
        'view'
      );
    });
  });

  describe('fetching post', () => {
    it('returns post when found', async () => {
      const mockPost = {
        id: POST_ID,
        title: 'Test Post',
        slug: 'test-post',
        content: 'Post content',
        merchant_id: MERCHANT_ID,
      };

      mockSupabase.single.mockResolvedValue({
        data: mockPost,
        error: null,
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ ...mockPost, embedded_products: [] });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', POST_ID);
      expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    });

    it('returns tenant-scoped embedded product IDs in the author-selected position order', async () => {
      const productIds = ['product-a', 'product-b'];
      mockSupabase.single.mockResolvedValue({
        data: { id: POST_ID, title: 'Test Post', slug: 'test-post' },
        error: null,
      });
      mockSupabase.order.mockResolvedValue({
        data: productIds.map((product_id) => ({ product_id })),
        error: null,
      });

      const response = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: POST_ID,
        title: 'Test Post',
        slug: 'test-post',
        embedded_products: productIds,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('blog_post_products');
      expect(mockSupabase.select).toHaveBeenCalledWith('product_id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
      expect(mockSupabase.eq).toHaveBeenCalledWith('blog_post_id', POST_ID);
      expect(mockSupabase.order).toHaveBeenCalledWith('position', {
        ascending: true,
      });
    });

    it('fails closed when loading embedded product links fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: POST_ID, title: 'Test Post', slug: 'test-post' },
        error: null,
      });
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'link lookup failed' },
      });

      const response = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Internal server error',
      });
    });

    it('selects featured image metadata for edit form hydration', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: POST_ID,
          title: 'Test Post',
          slug: 'test-post',
        },
        error: null,
      });

      await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_width')
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_height')
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_variants')
      );
    });

    it('returns 404 when post not found (PGRST116 error)', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Post not found');
    });

    it('returns 500 when database error occurs', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });

  describe('error handling', () => {
    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Unexpected error'));

      const res = await GET(
        makeRequest(`/api/merchant/blog/posts/${POST_ID}`, 'GET'),
        makeParams(POST_ID)
      );
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
