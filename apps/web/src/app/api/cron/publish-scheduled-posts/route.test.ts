import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantBlogCacheIdentifiers = vi.fn();
const mockRevalidateBlogPosts = vi.fn();

const createServiceClientMock = () => {
  const mock = {
    eq: vi.fn(),
    from: vi.fn(),
    in: vi.fn(),
    lte: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };

  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);

  return mock;
};

const mockSupabase = createServiceClientMock();

vi.mock('@/lib/get-merchant-blog-cache-identifiers', () => ({
  getMerchantBlogCacheIdentifiers: (...args: unknown[]) =>
    mockGetMerchantBlogCacheIdentifiers(...args),
}));

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateBlogPosts: (...args: unknown[]) => mockRevalidateBlogPosts(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}));

import { POST } from './route';

describe('POST /api/cron/publish-scheduled-posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createServiceClientMock());
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secrex',
        },
      })
    );

    expect(response.status).toBe(401);
  });

  it('publishes scheduled posts and revalidates all merchant blog identifiers', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
        {
          id: 'post-2',
          slug: 'macbook-air-m4-review',
          merchant_id: 'merchant-1',
          category: 'laptops',
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: Array.from({ length: 13 }, () => ({
          merchant_id: 'merchant-1',
        })),
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers.mockResolvedValue([
      'test-store',
      'ogabassey.com',
    ]);

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledWith(
      mockSupabase,
      'merchant-1'
    );
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledTimes(1);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['test-store', 'ogabassey.com'],
      listingCategories: ['reviews', 'laptops'],
      listingPages: [1, 2],
      postSlugs: ['apple-studio-display-review', 'macbook-air-m4-review'],
    });
    expect(mockRevalidateBlogPosts).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and records failed merchants when merchant cache identifier lookup fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
        {
          id: 'post-2',
          slug: 'macbook-air-m4-review',
          merchant_id: 'merchant-2',
          category: 'laptops',
        },
      ],
      error: null,
    });
    mockSupabase.in
      .mockResolvedValueOnce({
        data: [{ merchant_id: 'merchant-1' }, { merchant_id: 'merchant-2' }],
        error: null,
      })
      .mockResolvedValueOnce({ error: null });
    mockGetMerchantBlogCacheIdentifiers
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(['merchant-two']);

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe(
      'Failed to revalidate blog caches for some merchants'
    );
    expect(json.failedMerchants).toEqual(['merchant-1']);
    expect(mockGetMerchantBlogCacheIdentifiers).toHaveBeenCalledTimes(2);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledTimes(1);
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['merchant-two'],
      listingCategories: ['laptops'],
      listingPages: [1],
      postSlugs: ['macbook-air-m4-review'],
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Cron Error: Revalidation failed for merchant %s:',
      'merchant-1',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 before publishing when published blog counts cannot be loaded', async () => {
    mockSupabase.lte.mockResolvedValue({
      data: [
        {
          id: 'post-1',
          slug: 'apple-studio-display-review',
          merchant_id: 'merchant-1',
          category: 'reviews',
        },
      ],
      error: null,
    });
    mockSupabase.in.mockResolvedValueOnce({
      data: null,
      error: { message: 'count failed' },
    });

    const response = await POST(
      new Request('http://localhost/api/cron/publish-scheduled-posts', {
        method: 'POST',
        headers: {
          'x-cron-secret': 'test-secret',
        },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to load published blog counts');
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockRevalidateBlogPosts).not.toHaveBeenCalled();
  });
});
