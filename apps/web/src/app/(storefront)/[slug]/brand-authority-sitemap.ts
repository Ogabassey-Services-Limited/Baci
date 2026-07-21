import type { MetadataRoute } from 'next';
import { getCachedCategoryPageData } from '@/lib/cached-data';
import { brandAuthorityTaxonomy } from '@/lib/storefront-category/brand-authority-taxonomy';
import { getCachedBrandAuthorityInventory } from '@/lib/storefront-category/get-cached-brand-authority-inventory';
import type { StorefrontSitemapContext } from './sitemap-data';

export async function getBrandAuthoritySitemapEntries({
  merchant,
  storeUrl,
}: StorefrontSitemapContext): Promise<MetadataRoute.Sitemap> {
  const eligibleCategories = await Promise.all(
    brandAuthorityTaxonomy
      .getSupportedCategories()
      .map(async (categorySlug) => {
        try {
          const categoryData = await getCachedCategoryPageData(
            merchant.id,
            categorySlug,
            merchant.slug,
            0,
            1
          );
          return categoryData &&
            !categoryData.isCollection &&
            !categoryData.isInactiveCategory &&
            !categoryData.productsQueryFailed
            ? categorySlug
            : null;
        } catch (error) {
          console.warn('Failed to load brand authority sitemap category', {
            merchantId: merchant.id,
            categorySlug,
            error,
          });
          return null;
        }
      })
  );
  const categoryEntries = await Promise.all(
    eligibleCategories.flatMap((categorySlug) =>
      categorySlug === null
        ? []
        : brandAuthorityTaxonomy.getEntries(categorySlug).map(async (entry) => {
            try {
              const inventory = await getCachedBrandAuthorityInventory(
                merchant.id,
                categorySlug,
                entry
              );
              if (inventory.productCount < entry.minimumProducts) {
                return null;
              }
              return {
                url: `${storeUrl}/${entry.categorySlug}/brands/${entry.brandKey}`,
                lastModified: inventory.latestUpdatedAt
                  ? new Date(inventory.latestUpdatedAt)
                  : undefined,
                changeFrequency: 'daily' as const,
                priority: 0.7,
              };
            } catch (error) {
              console.warn('Failed to load brand authority sitemap entry', {
                merchantId: merchant.id,
                categorySlug,
                brandKey: entry.brandKey,
                error,
              });
              return null;
            }
          })
    )
  );
  return categoryEntries.filter(
    (entry): entry is NonNullable<typeof entry> => entry !== null
  );
}
