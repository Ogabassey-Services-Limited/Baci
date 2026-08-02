import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexingBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export function buildProductSeoDecision({
  isStorePublished,
  isActive,
  name,
  canonicalUrl,
}: {
  isStorePublished: boolean;
  isActive: boolean;
  name: string | null | undefined;
  canonicalUrl: string | null | undefined;
}): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
  if (!isStorePublished) blockers.push('store_unpublished');
  if (!isActive) blockers.push('inactive_product');
  if (!name?.trim()) blockers.push('missing_product_name');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_product_canonical_url');
  }
  return buildSeoIndexingDecision({ pageKind: 'product', blockers });
}
