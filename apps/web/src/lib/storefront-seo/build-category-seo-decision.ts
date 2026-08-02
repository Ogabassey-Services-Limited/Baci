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
  isStorePublished: boolean;
  isActive: boolean;
  hasProducts: boolean;
  canonicalUrl: string | null | undefined;
}): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
  if (!isStorePublished) blockers.push('store_unpublished');
  if (!isActive) blockers.push('inactive_category');
  if (!hasProducts) blockers.push('empty_category');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_category_canonical_url');
  }
  return buildSeoIndexingDecision({ pageKind: 'category', blockers });
}
