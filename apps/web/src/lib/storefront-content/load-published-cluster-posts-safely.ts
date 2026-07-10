import type { PublishedClusterPost } from './content-cluster-types';
import { getPublishedClusterPosts } from './get-published-cluster-posts';

/**
 * Failure-tolerant wrapper around getPublishedClusterPosts.
 *
 * The cached loader THROWS on query errors so Cache Components never caches
 * an empty guide-post list (stale-good entries keep serving). Page-level
 * callers must not let that throw take down the render — guide links are
 * enhancement content — so this wrapper degrades the failing request to []
 * while leaving the cache untouched. Mirrors loadSemanticInventorySafely.
 */
export async function loadPublishedClusterPostsSafely(
  merchantId: string,
  warningMessage: string
): Promise<PublishedClusterPost[]> {
  try {
    return await getPublishedClusterPosts(merchantId);
  } catch (error) {
    console.warn(warningMessage, {
      merchantId,
      error,
    });

    return [];
  }
}
