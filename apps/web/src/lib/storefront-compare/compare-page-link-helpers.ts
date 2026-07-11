import { cacheLife, cacheTag } from 'next/cache';
import {
  buildCategoryCompareGraphSlugSet,
  buildCompareLinkGraph,
  type CompareLinkGraphEntry,
  type CompareLinkGraphProduct,
} from '@/lib/storefront-link-modules/compare-link-graph';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';

/**
 * Canonical slugs in the unanchored maintained category compare-graph, cached
 * ONCE per category (local 'use cache'). buildCategoryCompareGraphSlugSet is
 * O(products^2) — it indexability-tests every product pair — and is identical
 * for every compare URL in the category. Building it inside each per-request
 * isMaintainedCompareGraphSlug call cost ~14s on prod-shape data / ~28s on
 * Vercel (the compare-page render stall). Caching the set per category turns the
 * per-URL category-membership check into an O(1) lookup. Local (not remote)
 * mirrors the other compare cache entries — the remote SET hangs for large
 * values. Throws on a transient inventory failure so an empty set is never
 * cached; loadCategoryCompareGraphSlugs degrades that to the curated fallback.
 */
export async function getCachedCategoryCompareGraphSlugs(input: {
  merchantId: string;
  categorySlug: string;
  storeUrl: string;
  categoryName: string;
}): Promise<string[]> {
  'use cache';
  try {
    cacheLife('products');
    cacheTag(
      'category-page-data',
      'products',
      'categories',
      `products-${input.merchantId}`,
      `categories-${input.merchantId}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  const products = (
    await getCachedProductSemanticInventory(
      input.merchantId,
      input.categorySlug
    )
  ).map((product) => ({ ...product, status: 'active' as const }));

  return buildCategoryCompareGraphSlugSet({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    products,
    productsAreKnownActive: false,
  });
}

/**
 * Fail-open wrapper: a transient failure computing the category graph degrades
 * this one request to the curated-slug indexability decision (like
 * loadCompareGraphProducts) rather than 404ing an otherwise-valid compare page.
 */
export async function loadCategoryCompareGraphSlugs(input: {
  merchantId: string;
  categorySlug: string;
  storeUrl: string;
  categoryName: string;
}): Promise<Set<string> | null> {
  try {
    return new Set(await getCachedCategoryCompareGraphSlugs(input));
  } catch (error) {
    console.warn('Failed to load category compare graph slugs', {
      categorySlug: input.categorySlug,
      merchantId: input.merchantId,
      error,
    });
    return null;
  }
}

export async function loadCompareGraphProducts(input: {
  categorySlug: string;
  merchantId: string;
}) {
  try {
    return {
      failed: false,
      products: await getCachedProductSemanticInventory(
        input.merchantId,
        input.categorySlug
      ),
    };
  } catch (error) {
    console.warn('Failed to load bounded compare graph inventory', {
      categorySlug: input.categorySlug,
      merchantId: input.merchantId,
      error,
    });
    return { failed: true, products: [] };
  }
}

export function includeClickedCompareProducts(input: {
  products: CompareLinkGraphProduct[];
  clickedProducts: Array<CompareLinkGraphProduct | undefined>;
}) {
  const productSlugs = new Set(
    input.products
      .map((product) => product.slug?.trim())
      .filter((slug): slug is string => Boolean(slug))
  );
  const clickedProducts = input.clickedProducts.filter(
    (product): product is CompareLinkGraphProduct =>
      Boolean(product?.slug && !productSlugs.has(product.slug))
  );

  return clickedProducts.length > 0
    ? [...input.products, ...clickedProducts]
    : input.products;
}

export function dedupeCompareLinks(links: CompareLinkGraphEntry[]) {
  return links.filter(
    (link, index) =>
      links.findIndex((candidate) => candidate.href === link.href) === index
  );
}

export function buildRelatedCompareLinks(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareLinkGraphProduct[];
  leftProductSlug: string;
  rightProductSlug: string;
  currentComparisonSlug: string;
}) {
  const leftLinks = buildCompareLinkGraph({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    products: input.products,
    productsAreKnownActive: true,
    anchorProductSlug: input.leftProductSlug,
    currentComparisonSlug: input.currentComparisonSlug,
    maxLinks: 3,
  });
  const rightLinks = buildCompareLinkGraph({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    products: input.products,
    productsAreKnownActive: true,
    anchorProductSlug: input.rightProductSlug,
    currentComparisonSlug: input.currentComparisonSlug,
    maxLinks: 3,
  });

  return dedupeCompareLinks([...leftLinks, ...rightLinks]).slice(0, 6);
}
