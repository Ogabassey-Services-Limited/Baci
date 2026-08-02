import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexingBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export function buildCategorySeoDecision({
  isStorePublished,
  isActive,
  hasProducts,
  canonicalUrl,
}: {
  isStorePublished: boolean | null | undefined;
  isActive: boolean | null | undefined;
  hasProducts: boolean;
  canonicalUrl: string | null | undefined;
}): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
  if (isStorePublished !== true) blockers.push('store_unpublished');
  if (isActive !== true) blockers.push('inactive_category');
  if (!hasProducts) blockers.push('empty_category');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_category_canonical_url');
  }
  return buildSeoIndexingDecision({ pageKind: 'category', blockers });
}
