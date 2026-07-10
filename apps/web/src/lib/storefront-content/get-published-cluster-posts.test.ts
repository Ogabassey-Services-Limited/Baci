import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedClusterPosts } from './get-published-cluster-posts';

const mockRpc = vi.fn();
const mockGetPublicSupabaseClient = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => mockGetPublicSupabaseClient(),
}));

const context = {
  pageKind: 'compare' as const,
  categorySlug: 'smartphones' as const,
  brands: ['Apple'],
  productSlugs: ['iphone-15-pro', 'samsung-galaxy-s25'],
};

describe('getPublishedClusterPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: [
        {
          slug: 'iphone-15-pro-vs-galaxy-s25',
          title: 'iPhone 15 Pro vs Galaxy S25',
          excerpt: 'Compare both phones.',
          category: 'Smartphones',
          tags: ['comparison'],
          keywords: ['iphone', 'galaxy'],
          featured_image_url: null,
          published_at: '2026-04-10T09:00:00.000Z',
          reading_time_minutes: 6,
        },
      ],
      error: null,
    });
    mockGetPublicSupabaseClient.mockReturnValue({ rpc: mockRpc });
  });

  it('loads a bounded, context-ranked candidate set through the public RPC', async () => {
    const result = await getPublishedClusterPosts('merchant-1', context);

    expect(mockRpc).toHaveBeenCalledWith(
      'get_storefront_cluster_guide_candidates_v1',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_limit: 64,
        p_search_query: expect.stringContaining('"smartphones"'),
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        slug: 'iphone-15-pro-vs-galaxy-s25',
        category: 'Smartphones',
      }),
    ]);
  });

  it('returns an empty candidate set when the RPC succeeds without rows', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      getPublishedClusterPosts('merchant-1', context)
    ).resolves.toEqual([]);
  });

  it('throws RPC failures so callers can degrade without caching the failure', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '57014', message: 'statement timeout' },
    });

    await expect(
      getPublishedClusterPosts('merchant-1', context)
    ).rejects.toMatchObject({ code: '57014' });
  });
});
