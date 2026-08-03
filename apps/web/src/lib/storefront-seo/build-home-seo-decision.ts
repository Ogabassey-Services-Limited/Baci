import { buildSeoIndexingDecision } from './build-seo-indexing-decision';
import { isValidStorefrontCanonicalUrl } from './is-valid-storefront-canonical-url';
import type { SeoIndexBlocker } from './seo-index-blocker';
import type { SeoIndexingDecision } from './seo-indexing-decision';

export interface HomeIndexingFacts {
  isPublished: boolean;
  canonicalUrl: string | null;
  merchantName: string | null;
}

export function buildHomeSeoDecision({
  isPublished,
  canonicalUrl,
  merchantName,
}: HomeIndexingFacts): SeoIndexingDecision {
  const blockers: SeoIndexBlocker[] = [];
  if (isPublished !== true) blockers.push('store_unpublished');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_canonical_url');
  }
  if (!merchantName?.trim()) blockers.push('missing_merchant_name');

  return buildSeoIndexingDecision({
    pageKind: 'home',
    blockers,
  });
}
