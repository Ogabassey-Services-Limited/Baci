import {
  buildSeoIndexingDecision,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export function buildHomeSeoDecision({
  isStorePublished,
}: {
  isStorePublished: boolean;
  canonicalUrl: string | null | undefined;
}): SeoIndexingDecision {
  return buildSeoIndexingDecision({
    pageKind: 'home',
    blockers: isStorePublished ? [] : ['store_unpublished'],
  });
}
