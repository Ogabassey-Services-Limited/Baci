import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedClusterPosts } from './get-published-cluster-posts';
import { loadPublishedClusterPostsSafely } from './load-published-cluster-posts-safely';

vi.mock('./get-published-cluster-posts', () => ({
  getPublishedClusterPosts: vi.fn(),
}));

const mockedGetPublishedClusterPosts = vi.mocked(getPublishedClusterPosts);

const context = {
  pageKind: 'category' as const,
  categorySlug: 'smartphones' as const,
};

describe('loadPublishedClusterPostsSafely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bounded guide candidates from the direct loader', async () => {
    mockedGetPublishedClusterPosts.mockResolvedValueOnce([
      {
        slug: 'best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        excerpt: null,
        category: 'Smartphones',
        tags: null,
        keywords: null,
        featured_image_url: null,
        published_at: '2026-07-09T00:00:00.000Z',
        reading_time_minutes: 5,
      },
    ]);

    await expect(
      loadPublishedClusterPostsSafely('merchant-1', context)
    ).resolves.toHaveLength(1);
    expect(mockedGetPublishedClusterPosts).toHaveBeenCalledWith(
      'merchant-1',
      context
    );
  });

  it('degrades optional guide links without caching a transient failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Expected fail-open diagnostic for optional guide links.
    });
    mockedGetPublishedClusterPosts.mockRejectedValueOnce(
      new Error('database timeout')
    );

    await expect(
      loadPublishedClusterPostsSafely('merchant-1', context)
    ).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to load bounded storefront guide candidates',
      expect.objectContaining({
        merchantId: 'merchant-1',
        categorySlug: 'smartphones',
        pageKind: 'category',
      })
    );

    warnSpy.mockRestore();
  });
});
