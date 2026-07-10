import type {
  BuildCommercialGuideLinksContext,
  PublishedClusterPost,
} from './content-cluster-types';
import { getPublishedClusterPosts } from './get-published-cluster-posts';

/**
 * Keeps optional semantic guide links from taking down a storefront render.
 * The direct bounded loader throws on database/transport failures; this outer
 * request boundary degrades only that request to no guide links and never
 * stores the failure in a cache.
 */
export async function loadPublishedClusterPostsSafely(
  merchantId: string,
  context: BuildCommercialGuideLinksContext
): Promise<PublishedClusterPost[]> {
  try {
    return await getPublishedClusterPosts(merchantId, context);
  } catch (error) {
    console.warn('Failed to load bounded storefront guide candidates', {
      merchantId,
      categorySlug: context.categorySlug,
      pageKind: context.pageKind,
      error,
    });
    return [];
  }
}
