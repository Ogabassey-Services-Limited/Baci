import { isRawDbProductRecord } from '@/lib/raw-db-product';
import { buildCompareDiscoveryLinks } from '@/lib/storefront-compare/build-compare-discovery-links';
import {
  buildCanonicalCompareCategories,
  type CompareIndexSection,
  normalizeCompareProduct,
  sortCompareSections,
  toRequestRelativeHref,
} from './compare-page-content-helpers';

export const COMPARE_INDEX_CATEGORY_DISCOVERY_LIMIT = 20;
export const COMPARE_INDEX_DISCOVERY_CONCURRENCY = 3;
export const COMPARE_INDEX_PRODUCTS_PER_CATEGORY_LIMIT = 80;
export const COMPARE_INDEX_LINKS_PER_CATEGORY_LIMIT = 80;
export const COMPARE_INDEX_TOTAL_LINK_LIMIT = 800;

interface CompareIndexCategory {
  name?: string | null;
  slug: string | null;
}

interface CompareIndexCategoryPageData {
  fallbackName?: string | null;
  isCollection?: boolean;
  isInactiveCategory?: boolean;
  products?: unknown[] | null;
}

interface BuildCompareIndexSectionsInput {
  categories: CompareIndexCategory[];
  categoryLimit?: number;
  concurrency?: number;
  getCategoryPageData: (
    categorySlug: string,
    productOffset: number,
    productLimit: number
  ) => Promise<CompareIndexCategoryPageData | null | undefined>;
  linksPerCategoryLimit?: number;
  pathPrefix?: string;
  productLimit?: number;
  storeUrl: string;
  totalLinkLimit?: number;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
) {
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

function capCompareIndexSections(
  sections: CompareIndexSection[],
  totalLinkLimit: number
) {
  const cappedSections: CompareIndexSection[] = [];
  let remainingLinks = Math.max(0, totalLinkLimit);

  for (const section of sections) {
    if (remainingLinks === 0) {
      break;
    }

    const links = section.links.slice(0, remainingLinks);

    if (links.length > 0) {
      cappedSections.push({
        ...section,
        links,
      });
      remainingLinks -= links.length;
    }
  }

  return cappedSections;
}

export async function buildCompareIndexSections({
  categories,
  categoryLimit = COMPARE_INDEX_CATEGORY_DISCOVERY_LIMIT,
  concurrency = COMPARE_INDEX_DISCOVERY_CONCURRENCY,
  getCategoryPageData,
  linksPerCategoryLimit = COMPARE_INDEX_LINKS_PER_CATEGORY_LIMIT,
  pathPrefix = '',
  productLimit = COMPARE_INDEX_PRODUCTS_PER_CATEGORY_LIMIT,
  storeUrl,
  totalLinkLimit = COMPARE_INDEX_TOTAL_LINK_LIMIT,
}: BuildCompareIndexSectionsInput) {
  const canonicalCategories = buildCanonicalCompareCategories(categories).slice(
    0,
    categoryLimit
  );
  const sections = await mapWithConcurrency(
    canonicalCategories,
    concurrency,
    async (category) => {
      const { categorySlug } = category;
      let categoryData: CompareIndexCategoryPageData | null | undefined;

      try {
        categoryData = await getCategoryPageData(categorySlug, 0, productLimit);
      } catch {
        return null;
      }

      if (
        !categoryData ||
        categoryData.isCollection ||
        categoryData.isInactiveCategory
      ) {
        return null;
      }

      const products = (categoryData.products ?? [])
        .filter(isRawDbProductRecord)
        .slice(0, productLimit)
        .map((product) => normalizeCompareProduct(product, categorySlug));
      const categoryName =
        categoryData.fallbackName || category.name || categorySlug;
      const links = buildCompareDiscoveryLinks({
        storeUrl,
        categorySlug,
        categoryName,
        includeBrandCompareLinks: false,
        products,
      })
        .slice(0, linksPerCategoryLimit)
        .map((link) => ({
          href: toRequestRelativeHref(link.href, storeUrl, pathPrefix),
          label: link.label,
        }));

      if (links.length === 0) {
        return null;
      }

      return {
        categoryName,
        categorySlug,
        links,
      } satisfies CompareIndexSection;
    }
  );

  const populatedSections = sections
    .filter((section): section is CompareIndexSection => section !== null)
    .sort(sortCompareSections);

  return capCompareIndexSections(populatedSections, totalLinkLimit);
}
