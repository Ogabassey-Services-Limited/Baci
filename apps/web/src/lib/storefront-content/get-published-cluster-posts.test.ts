import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedClusterPosts } from './get-published-cluster-posts';

const mockGetCachedFeatureSettings = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
}));

describe('getPublishedClusterPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
    mockOrder.mockResolvedValue({
      data: [
        {
          slug: 'best-phones-in-nigeria',
          title: 'Best Phones in Nigeria',
          excerpt: 'Budget and flagship phone picks.',
          category: 'Smartphones',
          tags: ['budget'],
          keywords: ['android'],
          featured_image_url: null,
          published_at: '2026-04-10T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      error: null,
    });
    mockEq.mockImplementation(() => ({ eq: mockEq, order: mockOrder }));
    mockSelect.mockImplementation(() => ({ eq: mockEq }));
    mockFrom.mockImplementation(() => ({ select: mockSelect }));
    mockGetPublicSupabaseClient.mockReturnValue({ from: mockFrom });
  });

  it('returns published blog posts when the blog feature is enabled', async () => {
    const result = await getPublishedClusterPosts('merchant-1');

    expect(mockFrom).toHaveBeenCalledWith('blog_posts');
    expect(mockSelect).toHaveBeenCalledWith(
      'slug, title, excerpt, category, tags, keywords, featured_image_url, published_at, reading_time_minutes'
    );
    expect(result).toEqual([
      expect.objectContaining({
        slug: 'best-phones-in-nigeria',
        category: 'Smartphones',
      }),
    ]);
  });

  it('returns an empty list when the blog feature is disabled', async () => {
    mockGetCachedFeatureSettings.mockResolvedValueOnce({ blog_enabled: false });

    const result = await getPublishedClusterPosts('merchant-1');

    expect(result).toEqual([]);
    expect(mockGetPublicSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns an empty list when the query fails', async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    });

    const result = await getPublishedClusterPosts('merchant-1');

    expect(result).toEqual([]);
  });
});
