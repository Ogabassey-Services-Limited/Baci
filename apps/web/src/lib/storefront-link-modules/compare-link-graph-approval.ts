import {
  buildCuratedCompareSlugSet,
  isCuratedCompareSlug,
} from '@/lib/storefront-compare/compare-indexability-policy';

interface CompareGraphApprovalProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

interface CompareGraphApprovalCandidate {
  comparisonSlug: string;
  productSlugs: [string, string];
}

interface SelectApprovedCompareGraphEntriesInput<
  TEntry extends CompareGraphApprovalCandidate,
> {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  policyProducts: CompareGraphApprovalProduct[];
  candidateEntries: TEntry[];
  requiredProductSlugs?: string[];
  maxLinks: number;
}

const COMPARE_GRAPH_SUPPLEMENTAL_APPROVAL_CANDIDATE_LIMIT = 150;

export function getSupplementalApprovalCandidateLimit(maxLinks: number) {
  return Math.min(
    COMPARE_GRAPH_SUPPLEMENTAL_APPROVAL_CANDIDATE_LIMIT,
    Math.max(16, maxLinks * 4)
  );
}

export function selectApprovedCompareGraphEntries<
  TEntry extends CompareGraphApprovalCandidate,
>({
  storeUrl,
  categorySlug,
  categoryName,
  policyProducts,
  candidateEntries,
  requiredProductSlugs,
  maxLinks,
}: SelectApprovedCompareGraphEntriesInput<TEntry>) {
  if (maxLinks <= 0) {
    return [];
  }

  const approvedEntries: TEntry[] = [];
  const curatedCompareSlugs = buildCuratedCompareSlugSet({
    storeUrl,
    categorySlug,
    categoryName,
    requiredProductSlugs,
    products: policyProducts,
  });
  const supplementalApprovalCandidateLimit =
    getSupplementalApprovalCandidateLimit(maxLinks);
  const supplementalCuratedCompareSlugsByComparisonSlug = new Map<
    string,
    Set<string>
  >();

  const isApprovedEntry = (entry: TEntry, index: number) => {
    if (isCuratedCompareSlug(entry.comparisonSlug, curatedCompareSlugs)) {
      return true;
    }

    if (index >= supplementalApprovalCandidateLimit) {
      return false;
    }

    const supplementalCuratedCompareSlugs =
      supplementalCuratedCompareSlugsByComparisonSlug.get(
        entry.comparisonSlug
      ) ??
      buildCuratedCompareSlugSet({
        storeUrl,
        categorySlug,
        categoryName,
        requiredProductSlugs: entry.productSlugs,
        products: policyProducts,
      });

    supplementalCuratedCompareSlugsByComparisonSlug.set(
      entry.comparisonSlug,
      supplementalCuratedCompareSlugs
    );

    return isCuratedCompareSlug(
      entry.comparisonSlug,
      supplementalCuratedCompareSlugs
    );
  };

  for (const [index, entry] of candidateEntries.entries()) {
    if (approvedEntries.length >= maxLinks) {
      break;
    }

    if (!isApprovedEntry(entry, index)) {
      continue;
    }

    approvedEntries.push(entry);
  }

  return approvedEntries;
}
