import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedProductGuidePosts } from './get-published-product-guide-posts';

const mockGetCachedFeatureSettings = vi.fn();
const mockQuery = {
  eq: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  not: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
};
const mockSupabase = {
  from: vi.fn(() => mockQuery),
};

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getPublicSupabaseClient: () => mockSupabase,
}));

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

describe('getPublishedProductGuidePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.not.mockReturnValue(mockQuery);
    mockQuery.order.mockReturnValue(mockQuery);
    mockQuery.limit.mockResolvedValue({
      data: [
        {
          blog_posts: {
            slug: 'xiaomi-17t-pro-guide',
            title: 'Xiaomi 17T Pro Guide',
            excerpt: 'Battery and camera buying context.',
            category: 'Smartphones',
            tags: ['xiaomi'],
            keywords: ['xiaomi 17t pro'],
            featured_image_url: null,
            published_at: '2026-06-20T09:00:00.000Z',
            reading_time_minutes: 7,
            status: 'published',
          },
        },
      ],
      error: null,
    });
  });

  it('loads explicit published blog links for a product', async () => {
    const posts = await getPublishedProductGuidePosts(
      'merchant-1',
      'product-1'
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('blog_post_products');
    expect(mockQuery.select).toHaveBeenCalledWith(
      'blog_posts!inner(slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes, status)'
    );
    expect(mockQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mockQuery.eq).toHaveBeenCalledWith('product_id', 'product-1');
    expect(mockQuery.eq).toHaveBeenCalledWith('blog_posts.status', 'published');
    expect(posts).toEqual([
      {
        slug: 'xiaomi-17t-pro-guide',
        title: 'Xiaomi 17T Pro Guide',
        excerpt: 'Battery and camera buying context.',
        category: 'Smartphones',
        tags: ['xiaomi'],
        keywords: ['xiaomi 17t pro'],
        featured_image_url: null,
        published_at: '2026-06-20T09:00:00.000Z',
        reading_time_minutes: 7,
      },
    ]);
  });

  it('returns no posts when the storefront blog is disabled', async () => {
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: false });

    await expect(
      getPublishedProductGuidePosts('merchant-1', 'product-1')
    ).resolves.toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
