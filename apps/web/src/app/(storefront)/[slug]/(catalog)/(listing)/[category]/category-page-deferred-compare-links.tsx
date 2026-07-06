import { CategoryHubSections } from '@/components/storefront/ogabassey/seo/category-hub-sections';
import type { CategoryHubModel } from '@/lib/storefront-category/category-hub-types';
import { loadCategoryPageCompareLinks } from './category-page-compare-links';

interface CategoryPageDeferredCompareLinksProps {
  storeUrl: string;
  merchantId: string;
  categorySlug: string;
  categoryName: string;
}

function buildComparisonOnlyHubModel(
  comparisonLinks: CategoryHubModel['comparisonLinks']
): CategoryHubModel {
  return {
    intro: {
      heading: '',
      description: '',
      source: 'fallback',
    },
    trustFeatures: [],
    bestForCards: [],
    brandCards: [],
    priceBandCards: [],
    comparisonLinks,
    guideLinks: [],
    faqItems: [],
  };
}

export async function CategoryPageDeferredCompareLinks({
  storeUrl,
  merchantId,
  categorySlug,
  categoryName,
}: CategoryPageDeferredCompareLinksProps) {
  const comparisonLinks = await loadCategoryPageCompareLinks({
    storeUrl,
    merchantId,
    categorySlug,
    categoryName,
  });

  if (comparisonLinks.length === 0) {
    return null;
  }

  return (
    <CategoryHubSections
      comparisonHeading="More product comparisons"
      headingIdPrefix="maintained-category-comparisons"
      hub={buildComparisonOnlyHubModel(comparisonLinks)}
    />
  );
}
