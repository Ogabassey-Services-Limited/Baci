import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

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
