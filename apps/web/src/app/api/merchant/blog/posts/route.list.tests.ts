import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChainableMock,
  GET,
  MERCHANT_ID,
  makeRequest,
  mockDispatchZohoBlogCampaign,
  mockGetMerchantForApiRequest,
  mockHasPermission,
  mockSupabase,
  setupAuth,
  USER_ID,
} from './route.test-support';

describe('GET /api/merchant/blog/posts', () => {
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
    it('returns 401 when user is not authenticated', async () => {
      setupAuth(false, false);

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 404 when merchant is not found', async () => {
      setupAuth(true, false);

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  it('authorizes the requested merchant before listing posts', async () => {
    await GET(makeRequest('/api/merchant/blog/posts'));

    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      USER_ID,
      { requestedMerchantId: MERCHANT_ID }
    );
  });

  describe('permissions', () => {
    it('returns 403 when user lacks marketing view permission', async () => {
      mockHasPermission.mockReturnValue(false);

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
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

  describe('filtering and pagination', () => {
    it('returns all posts with counts when no filters applied', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Post 1',
          slug: 'post-1',
          status: 'published',
        },
        {
          id: '2',
          title: 'Post 2',
          slug: 'post-2',
          status: 'draft',
        },
      ];

      // Mock the main posts query
      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 2,
      });

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.posts).toEqual(mockPosts);
      expect(json.total).toBe(2);
      expect(json.counts).toBeDefined();
    });

    it('selects featured image metadata for dashboard list readiness state', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await GET(makeRequest('/api/merchant/blog/posts'));

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_width'),
        { count: 'exact' }
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_height'),
        { count: 'exact' }
      );
      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('featured_image_variants'),
        { count: 'exact' }
      );
    });

    it('filters posts by status', async () => {
      const mockPosts = [
        { id: '1', title: 'Published Post', status: 'published' },
      ];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?status=published')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'published');
    });

    it('filters posts by category', async () => {
      const mockPosts = [{ id: '1', title: 'Tech Post', category: 'tech' }];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?category=tech')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.eq).toHaveBeenCalledWith('category', 'tech');
    });

    it('searches posts using full-text search', async () => {
      const mockPosts = [{ id: '1', title: 'Searchable Post' }];

      mockSupabase.range.mockResolvedValue({
        data: mockPosts,
        error: null,
        count: 1,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?search=searchable')
      );
      const _json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.textSearch).toHaveBeenCalledWith(
        'search_vector',
        'searchable',
        { type: 'websearch', config: 'english' }
      );
    });

    it('rejects search input longer than 100 characters', async () => {
      const longSearch = 'a'.repeat(150);
      const response = await GET(
        makeRequest(`/api/merchant/blog/posts?search=${longSearch}`)
      );

      expect(response.status).toBe(400);
      expect(mockSupabase.textSearch).not.toHaveBeenCalled();
    });

    it('applies pagination with limit and offset', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 50,
      });

      const res = await GET(
        makeRequest('/api/merchant/blog/posts?limit=10&offset=20')
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(mockSupabase.range).toHaveBeenCalledWith(20, 29);
      expect(json.limit).toBe(10);
      expect(json.offset).toBe(20);
      expect(json.hasMore).toBe(true);
    });

    it('applies custom sorting', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      await GET(
        makeRequest('/api/merchant/blog/posts?sortBy=title&sortOrder=asc')
      );

      expect(mockSupabase.order).toHaveBeenCalledWith('title', {
        ascending: true,
      });
    });
  });

  describe('error handling', () => {
    it('returns 500 when database query fails', async () => {
      mockSupabase.range.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Database error');
    });

    it('returns 500 when unexpected error occurs', async () => {
      mockSupabase.range.mockRejectedValue(new Error('Unexpected error'));

      const res = await GET(makeRequest('/api/merchant/blog/posts'));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
