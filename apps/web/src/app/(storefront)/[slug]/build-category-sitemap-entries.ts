import type { MetadataRoute } from 'next';
import { buildCategorySeoDecision } from '@/lib/storefront-seo/build-category-seo-decision';
import { isSeoSitemapEligible } from '@/lib/storefront-seo/seo-indexing-metadata';

interface SitemapCategory {
  id: string;
  slug: string | null;
  updated_at: string | null;
  is_active: boolean | null;
  parent_id: string | null;
}

export function buildCategorySitemapEntries({
  categories,
  categoryCounts,
  isStorePublished,
  storeUrl,
}: {
  categories: SitemapCategory[];
  categoryCounts: Record<string, number>;
  isStorePublished: boolean | null | undefined;
  storeUrl: string;
}): MetadataRoute.Sitemap {
  return categories.flatMap((category) => {
    const slug = category.slug?.trim();
    const url = slug ? `${storeUrl}/${slug}` : null;
    const decision = buildCategorySeoDecision({
      isStorePublished: isStorePublished === true,
      isAvailable: category.is_active === true,
      querySucceeded: true,
      activeProductCount: categoryCounts[category.id] ?? 0,
    });

    if (!url || !isSeoSitemapEligible(decision)) return [];

    return [
      {
        url,
        lastModified: category.updated_at
          ? new Date(category.updated_at)
          : undefined,
        changeFrequency: 'daily',
        priority: 0.7,
      },
    ];
  });
}
