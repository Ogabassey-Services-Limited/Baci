import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexingBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export interface ProductIndexingFacts {
  isStorePublished: boolean | null | undefined;
  isActive: boolean | null | undefined;
  name: string | null | undefined;
  canonicalUrl: string | null | undefined;
}

export function buildProductSeoDecision({
  isStorePublished,
  isActive,
  name,
  canonicalUrl,
}: ProductIndexingFacts): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
  if (isStorePublished !== true) blockers.push('store_unpublished');
  if (isActive !== true) blockers.push('product_inactive');
  if (!name?.trim()) blockers.push('missing_product_name');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_product_canonical_url');
  }
  return buildSeoIndexingDecision({ pageKind: 'product', blockers });
}
