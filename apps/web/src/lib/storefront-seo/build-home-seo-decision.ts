import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexingBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export interface HomeIndexingFacts {
  isPublished: boolean | null | undefined;
  canonicalUrl: string | null | undefined;
  merchantName: string | null | undefined;
}

export function buildHomeSeoDecision({
  isPublished,
  canonicalUrl,
  merchantName,
}: HomeIndexingFacts): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
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
