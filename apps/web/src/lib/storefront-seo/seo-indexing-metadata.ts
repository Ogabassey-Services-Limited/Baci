import type { Metadata } from 'next';
import type { SeoIndexingDecision } from './seo-indexing-decision';

export function toNextRobotsMetadata(
  decision: SeoIndexingDecision
): Metadata['robots'] {
  return { index: decision.index, follow: true };
}

export function isSeoSitemapEligible(decision: SeoIndexingDecision): boolean {
  return decision.index;
}
