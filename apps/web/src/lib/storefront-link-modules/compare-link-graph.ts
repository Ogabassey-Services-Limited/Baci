import { buildProductCompareCandidate } from '@/lib/storefront-compare/compare-eligibility';
import {
  buildCanonicalProductCompareSlug,
  parseCompareSlug,
} from '@/lib/storefront-compare/compare-slugs';
import { selectApprovedCompareGraphEntries } from './compare-link-graph-approval';

export interface CompareLinkGraphProduct {
  id?: string | null;
  name: string;
  slug?: string | null;
  brand?: string | null;
  price?: number | string | null;
  status?: string | null;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

export interface CompareLinkGraphEntry {
  href: string;
  label: string;
  description: string;
  categorySlug: string;
  comparisonSlug: string;
  productSlugs: [string, string];
  productNames: [string, string];
  anchorProductSlug?: string;
  score: number;
}

export interface BuildCompareLinkGraphInput {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CompareLinkGraphProduct[];
  anchorProductSlug?: string;
  currentComparisonSlug?: string;
  maxLinks?: number;
  productsAreKnownActive?: boolean;
}

export const COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT = 80;

function hasUsefulSpecs(product: CompareLinkGraphProduct) {
  return Object.keys(product.product_key_specs ?? {}).length > 0;
}

function isActiveCompareProduct(
  product: CompareLinkGraphProduct,
  productsAreKnownActive: boolean
) {
  const slug = typeof product.slug === 'string' ? product.slug.trim() : '';
  const name = product.name.trim();

  return Boolean(
    slug && name && (productsAreKnownActive || product.status === 'active')
  );
}

function normalizePrice(value: CompareLinkGraphProduct['price']) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function productScore(product: CompareLinkGraphProduct) {
  let score = 0;

  if (normalizePrice(product.price) > 0) {
    score += 2;
  }

  if (hasUsefulSpecs(product)) {
    score += 3;
  }

  if (product.brand) {
    score += 1;
  }

  return score;
}

function entryScore(
  left: CompareLinkGraphProduct,
  right: CompareLinkGraphProduct,
  anchorProductSlug?: string
) {
  const anchorBoost =
    anchorProductSlug && [left.slug, right.slug].includes(anchorProductSlug)
      ? 20
      : 0;

  return anchorBoost + productScore(left) + productScore(right);
}

export function buildCompareLinkGraph({
  storeUrl,
  categorySlug,
  categoryName,
  products,
  anchorProductSlug,
  currentComparisonSlug,
  maxLinks = 12,
  productsAreKnownActive = false,
}: BuildCompareLinkGraphInput): CompareLinkGraphEntry[] {
  const activeProducts = products.filter(
    (product) =>
      product.category_slug === categorySlug &&
      isActiveCompareProduct(product, productsAreKnownActive)
  );
  const policyProducts = activeProducts.map((product) => ({
    slug: product.slug?.trim() ?? '',
    name: product.name,
    brand: product.brand,
    price: normalizePrice(product.price),
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  }));
  const candidateEntries: CompareLinkGraphEntry[] = [];

  for (let leftIndex = 0; leftIndex < activeProducts.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < activeProducts.length;
      rightIndex += 1
    ) {
      const left = activeProducts[leftIndex];
      const right = activeProducts[rightIndex];
      const leftSlug = left.slug?.trim();
      const rightSlug = right.slug?.trim();

      if (!leftSlug || !rightSlug) {
        continue;
      }

      if (
        anchorProductSlug &&
        leftSlug !== anchorProductSlug &&
        rightSlug !== anchorProductSlug
      ) {
        continue;
      }

      const comparisonSlug = buildCanonicalProductCompareSlug(
        leftSlug,
        rightSlug
      );

      if (comparisonSlug === currentComparisonSlug) {
        continue;
      }

      const candidate = buildProductCompareCandidate({
        categorySlug,
        leftProduct: {
          slug: leftSlug,
          name: left.name,
          category_slug: left.category_slug,
          product_key_specs: left.product_key_specs,
        },
        rightProduct: {
          slug: rightSlug,
          name: right.name,
          category_slug: right.category_slug,
          product_key_specs: right.product_key_specs,
        },
      });

      if (!candidate.isIndexable) {
        continue;
      }

      candidateEntries.push({
        href: `/${categorySlug}/compare/${comparisonSlug}`,
        label: `Compare ${left.name} with ${right.name}`,
        description: `Compare price, specs, condition, and buying fit for ${left.name} and ${right.name}.`,
        categorySlug,
        comparisonSlug,
        productSlugs: [leftSlug, rightSlug],
        productNames: [left.name, right.name],
        anchorProductSlug,
        score: entryScore(left, right, anchorProductSlug),
      });
    }
  }

  const sortedCandidateEntries = candidateEntries.sort(
    (left, right) =>
      right.score - left.score || left.label.localeCompare(right.label)
  );

  return selectApprovedCompareGraphEntries({
    storeUrl,
    categorySlug,
    categoryName,
    requiredProductSlugs: anchorProductSlug ? [anchorProductSlug] : undefined,
    policyProducts,
    candidateEntries: sortedCandidateEntries,
    maxLinks,
  });
}

export function isMaintainedCompareGraphSlug(
  input: BuildCompareLinkGraphInput & { comparisonSlug: string }
) {
  const parsed = parseCompareSlug(input.comparisonSlug);

  if (!parsed) {
    return false;
  }

  const isInGraph = (links: CompareLinkGraphEntry[]) =>
    links.some((entry) => entry.comparisonSlug === parsed.canonicalSlug);

  if (
    isInGraph(
      buildCompareLinkGraph({
        ...input,
        currentComparisonSlug: undefined,
        maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
      })
    )
  ) {
    return true;
  }

  return [parsed.leftKey, parsed.rightKey].some((anchorProductSlug) =>
    isInGraph(
      buildCompareLinkGraph({
        ...input,
        anchorProductSlug,
        currentComparisonSlug: undefined,
        maxLinks: 8,
      })
    )
  );
}
