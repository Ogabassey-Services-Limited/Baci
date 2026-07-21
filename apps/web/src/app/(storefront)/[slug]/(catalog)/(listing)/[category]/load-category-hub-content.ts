import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import type { getCachedCategoryPageData } from '@/lib/cached-data';
import { getCachedBrandAuthorityEntries } from '@/lib/storefront-category/get-cached-brand-authority-entries';
import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import { loadPublishedClusterPostsSafely } from '@/lib/storefront-content/load-published-cluster-posts-safely';

type CategoryPageData = Awaited<ReturnType<typeof getCachedCategoryPageData>>;

export async function loadCategoryHubContent(input: {
  merchantId: string;
  categorySlug: string;
  categoryData: CategoryPageData;
}) {
  const supportedCategory =
    input.categorySlug in CONTENT_CLUSTER_SUPPORT
      ? (input.categorySlug as SupportedClusterCategory)
      : null;
  const canLoadAuthority =
    !input.categoryData.isCollection &&
    !input.categoryData.isInactiveCategory &&
    Boolean(input.categoryData.category?.id);

  const [guidePosts, brandAuthorityEntries] = await Promise.all([
    supportedCategory
      ? loadPublishedClusterPostsSafely(input.merchantId, {
          pageKind: 'category',
          categorySlug: supportedCategory,
        })
      : Promise.resolve([]),
    canLoadAuthority
      ? getCachedBrandAuthorityEntries(input.merchantId, input.categorySlug)
      : Promise.resolve([]),
  ]);

  return { guidePosts, brandAuthorityEntries };
}
