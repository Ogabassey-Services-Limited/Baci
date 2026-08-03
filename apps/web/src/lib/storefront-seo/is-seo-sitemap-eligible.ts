import type { SeoIndexingDecision } from './seo-indexing-decision';

export function isSeoSitemapEligible(decision: SeoIndexingDecision): boolean {
  return decision.index;
}
