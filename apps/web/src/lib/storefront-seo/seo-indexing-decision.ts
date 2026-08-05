import type { SeoIndexBlocker } from './seo-index-blocker';
import type { SeoPageKind } from './seo-page-kind';

export interface SeoIndexingDecision {
  pageKind: SeoPageKind;
  index: boolean;
  follow: true;
  blockers: readonly SeoIndexBlocker[];
}
