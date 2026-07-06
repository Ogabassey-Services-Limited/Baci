import {
  buildCompareLinkGraph,
  type CompareLinkGraphEntry,
  type CompareLinkGraphProduct,
} from '@/lib/storefront-link-modules/compare-link-graph';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';

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
