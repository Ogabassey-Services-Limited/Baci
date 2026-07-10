import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublishedClusterPostsSafely } from '@/lib/storefront-content/load-published-cluster-posts-safely';

const mockGetPublishedClusterPosts = vi.fn();

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
}));

describe('loadPublishedClusterPostsSafely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the cached posts on success', async () => {
    const posts = [{ slug: 'best-phones', title: 'Best Phones' }];
    mockGetPublishedClusterPosts.mockResolvedValue(posts);

    await expect(
      loadPublishedClusterPostsSafely('merchant-1', 'guide posts failed')
    ).resolves.toEqual(posts);
    expect(mockGetPublishedClusterPosts).toHaveBeenCalledWith('merchant-1');
  });

  it('degrades to an empty list and warns when the cached loader throws', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const failure = new Error('TimeoutError: aborted due to timeout');
    mockGetPublishedClusterPosts.mockRejectedValue(failure);

    await expect(
      loadPublishedClusterPostsSafely('merchant-1', 'guide posts failed')
    ).resolves.toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalledWith('guide posts failed', {
      merchantId: 'merchant-1',
      error: failure,
    });
  });
});
