import { buildSeoIndexingDecision } from './build-seo-indexing-decision';
import { isValidStorefrontCanonicalUrl } from './is-valid-storefront-canonical-url';
import type { SeoIndexBlocker } from './seo-index-blocker';
import type { SeoIndexingDecision } from './seo-indexing-decision';

export interface ProductIndexingFacts {
  isStorePublished: boolean;
  isActive: boolean;
  name: string | null;
  canonicalUrl: string | null;
}

export function buildProductSeoDecision({
  isStorePublished,
  isActive,
  name,
  canonicalUrl,
}: ProductIndexingFacts): SeoIndexingDecision {
  const blockers: SeoIndexBlocker[] = [];
  if (isStorePublished !== true) blockers.push('store_unpublished');
  if (isActive !== true) blockers.push('product_inactive');
  if (!name?.trim()) blockers.push('missing_product_name');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_product_canonical_url');
  }
  return buildSeoIndexingDecision({ pageKind: 'product', blockers });
}
