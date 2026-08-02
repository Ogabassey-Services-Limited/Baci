import {
  buildSeoIndexingDecision,
  isValidStorefrontCanonicalUrl,
  type SeoIndexingBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export function buildHomeSeoDecision({
  isStorePublished,
  canonicalUrl,
  merchantName,
}: {
  isStorePublished: boolean | null | undefined;
  canonicalUrl: string | null | undefined;
  merchantName: string | null | undefined;
}): SeoIndexingDecision {
  const blockers: SeoIndexingBlocker[] = [];
  if (isStorePublished !== true) blockers.push('store_unpublished');
  if (!isValidStorefrontCanonicalUrl(canonicalUrl)) {
    blockers.push('missing_home_canonical_url');
  }
  if (!merchantName?.trim()) blockers.push('missing_home_merchant_name');

  return buildSeoIndexingDecision({
    pageKind: 'home',
    blockers,
  });
}
