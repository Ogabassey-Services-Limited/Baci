import type { CategoryHubComparisonLink } from '@/lib/storefront-category/category-hub-types';
import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';

async function loadCategoryCompareProducts(input: {
  merchantId: string;
  categorySlug: string;
}) {
  try {
    return await getCachedProductSemanticInventory(
      input.merchantId,
      input.categorySlug
    );
  } catch (error) {
    console.warn('Failed to load category compare inventory', {
      categorySlug: input.categorySlug,
      merchantId: input.merchantId,
      error,
    });
    return [];
  }
}

function buildRequestScopedLink(storeUrl: string, href: string) {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return `${storeUrl}/${href.replace(/^\/+/, '')}`;
}

export async function loadCategoryPageCompareLinks(input: {
  storeUrl: string;
  merchantId: string;
  categorySlug: string;
  categoryName: string;
}): Promise<CategoryHubComparisonLink[]> {
  const products = await loadCategoryCompareProducts({
    merchantId: input.merchantId,
    categorySlug: input.categorySlug,
  });
  const graphLinks = buildCompareLinkGraph({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    products,
    productsAreKnownActive: true,
    maxLinks: 6,
  });

  if (graphLinks.length === 0) {
    return [];
  }

  const categoryLabel =
    input.categoryName.trim().length > 0
      ? input.categoryName.trim().toLowerCase()
      : input.categorySlug;

  return [
    {
      href: `${input.storeUrl}/${input.categorySlug}/compare`,
      label: `View all ${categoryLabel} comparisons`,
    },
    ...graphLinks.map((link) => ({
      href: buildRequestScopedLink(input.storeUrl, link.href),
      label: link.label,
    })),
  ];
}
