import { describe, expect, it } from 'vitest';
import { buildSeoIndexingDecision } from './build-seo-indexing-decision';

describe('buildSeoIndexingDecision', () => {
  it('deduplicates blockers while preserving the decision facts', () => {
    expect(
      buildSeoIndexingDecision({
        pageKind: 'home',
        blockers: ['store_unpublished', 'store_unpublished'],
      })
    ).toEqual({
      pageKind: 'home',
      index: false,
      follow: true,
      blockers: ['store_unpublished'],
    });
  });
});
