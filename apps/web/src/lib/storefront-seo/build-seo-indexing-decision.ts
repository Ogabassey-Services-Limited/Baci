import type { SeoIndexBlocker } from './seo-index-blocker';
import type { SeoIndexingDecision } from './seo-indexing-decision';
import type { SeoPageKind } from './seo-page-kind';

export function buildSeoIndexingDecision({
  pageKind,
  blockers,
}: {
  pageKind: SeoPageKind;
  blockers: readonly SeoIndexBlocker[];
}): SeoIndexingDecision {
  return {
    pageKind,
    index: blockers.length === 0,
    follow: true,
    blockers: [...new Set(blockers)],
  };
}
