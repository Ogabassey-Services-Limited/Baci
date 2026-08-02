import {
  buildSeoIndexingDecision,
  type SeoIndexBlocker,
  type SeoIndexingDecision,
} from './seo-indexing-decision';

export interface CategoryIndexingFacts {
  isStorePublished: boolean;
  isAvailable: boolean;
  querySucceeded: boolean;
  activeProductCount: number;
}

export function buildCategorySeoDecision({
  isStorePublished,
  isAvailable,
  querySucceeded,
  activeProductCount,
}: CategoryIndexingFacts): SeoIndexingDecision {
  const blockers: SeoIndexBlocker[] = [];
  if (isStorePublished !== true) blockers.push('store_unpublished');
  if (isAvailable !== true) blockers.push('category_unavailable');
  if (!querySucceeded) blockers.push('category_data_unavailable');
  if (querySucceeded && activeProductCount <= 0) {
    blockers.push('category_empty');
  }
  return buildSeoIndexingDecision({ pageKind: 'category', blockers });
}
