import { buildProductCompareCandidate } from '@/lib/storefront-compare/compare-eligibility';
import {
  buildCanonicalProductCompareSlug,
  parseCompareSlug,
} from '@/lib/storefront-compare/compare-slugs';
import { selectApprovedCompareGraphEntries } from './compare-link-graph-approval';
import {
  buildCanonicalPair,
  forEachComparePair,
} from './compare-link-graph-pairs';

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
export const MAX_PRODUCT_COMPARE_LINKS = 8;
const COMPARE_GRAPH_UNANCHORED_PRODUCT_WINDOW_MIN = 48;
const COMPARE_GRAPH_UNANCHORED_PRODUCT_WINDOW_MULTIPLIER = 8;

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

function getPairCandidateProducts(input: {
  activeProducts: CompareLinkGraphProduct[];
  anchorProductSlug?: string;
  maxLinks: number;
}) {
  if (input.anchorProductSlug) {
    return input.activeProducts;
  }

  const productWindowSize = Math.max(
    COMPARE_GRAPH_UNANCHORED_PRODUCT_WINDOW_MIN,
    input.maxLinks * COMPARE_GRAPH_UNANCHORED_PRODUCT_WINDOW_MULTIPLIER
  );

  return input.activeProducts.slice(0, productWindowSize);
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
  const pairCandidateProducts = getPairCandidateProducts({
    activeProducts,
    anchorProductSlug,
    maxLinks,
  });
  const policyProducts = activeProducts.map((product) => ({
    slug: product.slug?.trim() ?? '',
    name: product.name,
    brand: product.brand,
    price: normalizePrice(product.price),
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  }));
  const candidateEntries: CompareLinkGraphEntry[] = [];

  forEachComparePair(
    pairCandidateProducts,
    anchorProductSlug,
    (left: CompareLinkGraphProduct, right: CompareLinkGraphProduct) => {
      const leftSlug = left.slug?.trim();
      const rightSlug = right.slug?.trim();

      if (!leftSlug || !rightSlug) {
        return;
      }

      const comparisonSlug = buildCanonicalProductCompareSlug(
        leftSlug,
        rightSlug
      );

      if (comparisonSlug === currentComparisonSlug) {
        return;
      }

      const canonicalPair = buildCanonicalPair({
        comparisonSlug,
        left,
        leftSlug,
        right,
        rightSlug,
      });

      if (!canonicalPair) {
        return;
      }

      const candidate = buildProductCompareCandidate({
        categorySlug,
        leftProduct: {
          slug: canonicalPair.leftSlug,
          name: canonicalPair.left.name,
          category_slug: canonicalPair.left.category_slug,
          product_key_specs: canonicalPair.left.product_key_specs,
        },
        rightProduct: {
          slug: canonicalPair.rightSlug,
          name: canonicalPair.right.name,
          category_slug: canonicalPair.right.category_slug,
          product_key_specs: canonicalPair.right.product_key_specs,
        },
      });

      if (!candidate.isIndexable) {
        return;
      }

      candidateEntries.push({
        href: `/${categorySlug}/compare/${comparisonSlug}`,
        label: `Compare ${canonicalPair.left.name} with ${canonicalPair.right.name}`,
        description: `Compare price, specs, condition, and buying fit for ${canonicalPair.left.name} and ${canonicalPair.right.name}.`,
        categorySlug,
        comparisonSlug,
        productSlugs: [canonicalPair.leftSlug, canonicalPair.rightSlug],
        productNames: [canonicalPair.left.name, canonicalPair.right.name],
        anchorProductSlug,
        score: entryScore(left, right, anchorProductSlug),
      });
    }
  );

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

/**
 * The set of canonical comparison slugs in the UNANCHORED maintained category
 * compare-graph. This is O(activeProducts^2) — it scores + indexability-tests
 * every product pair (buildProductCompareCandidate) — and is IDENTICAL for
 * every compare URL in the category. Building it per compare render cost ~14s
 * on prod-shape data / ~28s on Vercel (the compare-page stall). Compute it ONCE
 * per category (see getCachedCategoryCompareGraphSlugs) and pass the resulting
 * set to isMaintainedCompareGraphSlug so the per-URL check is O(1).
 */
export function buildCategoryCompareGraphSlugSet(
  input: BuildCompareLinkGraphInput
): string[] {
  return buildCompareLinkGraph({
    ...input,
    anchorProductSlug: undefined,
    currentComparisonSlug: undefined,
    maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
  }).map((entry) => entry.comparisonSlug);
}

export function isMaintainedCompareGraphSlug(
  input: BuildCompareLinkGraphInput & {
    comparisonSlug: string;
    // Precomputed unanchored category-graph slugs (cached per category). When
    // provided, the expensive O(n^2) unanchored build is skipped in favour of
    // an O(1) membership check; the cheap anchored checks still run per URL.
    categoryGraphSlugs?: ReadonlySet<string>;
  }
) {
  const parsed = parseCompareSlug(input.comparisonSlug);

  if (!parsed) {
    return false;
  }

  const isInGraph = (links: CompareLinkGraphEntry[]) =>
    links.some((entry) => entry.comparisonSlug === parsed.canonicalSlug);

  const inCategoryGraph = input.categoryGraphSlugs
    ? input.categoryGraphSlugs.has(parsed.canonicalSlug)
    : isInGraph(
        buildCompareLinkGraph({
          ...input,
          currentComparisonSlug: undefined,
          maxLinks: COMPARE_GRAPH_INDEXABLE_CATEGORY_LINK_LIMIT,
        })
      );

  if (inCategoryGraph) {
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
