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
        },
      ],
      error: null,
    });
    mockSupabase.in.mockResolvedValue({ error: null });
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
    expect(mockRevalidateBlogPosts).toHaveBeenCalledWith({
      identifiers: ['test-store', 'ogabassey.com'],
      postSlugs: ['apple-studio-display-review'],
    });
  });
});
